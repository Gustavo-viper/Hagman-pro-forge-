import type pg from 'pg';

export interface LifecycleConfig {
  graceDays: number;
  pendingTtlHours: number;
}

export interface LifecycleResult {
  pendingExpired: number;
  movedToPastDue: number;
  pastDueExpired: number;
  cancelledExpired: number;
}

const ACTOR = 'worker:subscription-lifecycle';

/**
 * Time-based subscription transitions. Payment-driven transitions (activation, renewal,
 * failure) come ONLY from verified provider webhooks in the API; this job only handles
 * what happens when time passes without such a confirmation:
 *
 *   pending   older than TTL                   → expired   (abandoned checkout)
 *   active    period ended, no renewal webhook → past_due  (grace_until = end + graceDays)
 *   past_due  grace period over                → expired
 *   cancelled paid period over                 → expired
 *
 * Each transition writes subscription_status_history in the same transaction.
 * Rows are locked with SKIP LOCKED, so concurrent workers never double-process.
 */
export async function runSubscriptionLifecycle(
  client: pg.ClientBase,
  config: LifecycleConfig,
  now: Date = new Date(),
): Promise<LifecycleResult> {
  const transition = async (
    where: string,
    params: unknown[],
    to: 'expired' | 'past_due',
    reason: string,
    setGrace = false,
  ): Promise<number> => {
    await client.query('BEGIN');
    try {
      const { rows } = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM subscriptions WHERE ${where} ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 500`,
        params,
      );
      if (rows.length) {
        const ids = rows.map((r) => r.id);
        if (setGrace) {
          await client.query(
            `UPDATE subscriptions SET status = $2, grace_until = current_period_end + make_interval(days => $3)
              WHERE id = ANY($1::uuid[])`,
            [ids, to, config.graceDays],
          );
        } else {
          await client.query('UPDATE subscriptions SET status = $2 WHERE id = ANY($1::uuid[])', [ids, to]);
        }
        await client.query(
          `INSERT INTO subscription_status_history (subscription_id, from_status, to_status, reason, actor)
           SELECT r.id, r.status, $2, $3, $4 FROM unnest($1::uuid[], $5::text[]) AS r(id, status)`,
          [ids, to, reason, ACTOR, rows.map((r) => r.status)],
        );
      }
      await client.query('COMMIT');
      return rows.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  };

  const pendingExpired = await transition(
    `status = 'pending' AND created_at < $1::timestamptz - make_interval(hours => $2)`,
    [now, config.pendingTtlHours],
    'expired',
    'pending_checkout_timeout',
  );
  const movedToPastDue = await transition(
    `status = 'active' AND current_period_end IS NOT NULL AND current_period_end <= $1`,
    [now],
    'past_due',
    'period_ended_without_renewal',
    true,
  );
  const pastDueExpired = await transition(
    `status = 'past_due' AND (grace_until IS NULL OR grace_until <= $1)`,
    [now],
    'expired',
    'grace_period_ended',
  );
  const cancelledExpired = await transition(
    `status = 'cancelled' AND (current_period_end IS NULL OR current_period_end <= $1)`,
    [now],
    'expired',
    'paid_period_ended',
  );
  return { pendingExpired, movedToPastDue, pastDueExpired, cancelledExpired };
}
