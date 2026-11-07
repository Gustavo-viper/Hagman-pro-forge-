import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSubscriptionLifecycle } from '../src/jobs/subscription-lifecycle.js';

const url = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(url))('subscription lifecycle job', () => {
  const client = new pg.Client({ connectionString: url });
  const now = new Date('2026-11-07T12:00:00Z');
  const day = 86_400_000;

  async function sub(status: string, fields: { created?: Date; periodEnd?: Date | null; grace?: Date | null } = {}) {
    const userId = randomUUID();
    await client.query('INSERT INTO users (id, email) VALUES ($1, $2)', [userId, `${userId}@t.test`]);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO subscriptions (user_id, plan_code, price_id, status, provider, created_at, current_period_end, grace_until)
       SELECT $1, 'plus', id, $2, 'stripe', $3, $4, $5 FROM plan_prices WHERE plan_code='plus' AND billing_interval='month' AND currency='BRL'
       RETURNING id`,
      [userId, status, fields.created ?? now, fields.periodEnd ?? null, fields.grace ?? null],
    );
    return rows[0]!.id;
  }
  const statusOf = async (id: string) =>
    (await client.query<{ status: string; grace_until: Date | null }>('SELECT status, grace_until FROM subscriptions WHERE id=$1', [id])).rows[0]!;

  beforeAll(() => client.connect());
  afterAll(() => client.end());

  it('applies every time-based transition with history', async () => {
    const oldPending = await sub('pending', { created: new Date(now.getTime() - 3 * day) });
    const freshPending = await sub('pending', { created: new Date(now.getTime() - 3_600_000) });
    const endedActive = await sub('active', { periodEnd: new Date(now.getTime() - day) });
    const runningActive = await sub('active', { periodEnd: new Date(now.getTime() + 10 * day) });
    const graceOver = await sub('past_due', { grace: new Date(now.getTime() - 1000) });
    const inGrace = await sub('past_due', { grace: new Date(now.getTime() + day) });
    const cancelledOver = await sub('cancelled', { periodEnd: new Date(now.getTime() - 1000) });
    const cancelledPaid = await sub('cancelled', { periodEnd: new Date(now.getTime() + day) });

    const result = await runSubscriptionLifecycle(client, { graceDays: 3, pendingTtlHours: 48 }, now);
    expect(result).toEqual({ pendingExpired: 1, movedToPastDue: 1, pastDueExpired: 1, cancelledExpired: 1 });

    expect((await statusOf(oldPending)).status).toBe('expired');
    expect((await statusOf(freshPending)).status).toBe('pending');
    const pd = await statusOf(endedActive);
    expect(pd.status).toBe('past_due');
    // grace = period end (now - 1d) + 3 days → still in the future, so it is NOT expired in the same run.
    expect(pd.grace_until!.getTime()).toBe(now.getTime() + 2 * day);
    expect((await statusOf(runningActive)).status).toBe('active');
    expect((await statusOf(graceOver)).status).toBe('expired');
    expect((await statusOf(inGrace)).status).toBe('past_due');
    expect((await statusOf(cancelledOver)).status).toBe('expired');
    expect((await statusOf(cancelledPaid)).status).toBe('cancelled');

    const history = await client.query(
      "SELECT from_status, to_status, reason FROM subscription_status_history WHERE subscription_id = $1",
      [endedActive],
    );
    expect(history.rows).toEqual([{ from_status: 'active', to_status: 'past_due', reason: 'period_ended_without_renewal' }]);

    // Idempotent: a second run at the same instant changes nothing.
    expect(await runSubscriptionLifecycle(client, { graceDays: 3, pendingTtlHours: 48 }, now)).toEqual({
      pendingExpired: 0, movedToPastDue: 0, pastDueExpired: 0, cancelledExpired: 0,
    });
  });
});
