import type pg from 'pg';
import { formatMoney, type EmailJobData, type Locale } from '@fandom/shared';

const PLAN_NAMES: Record<string, string> = { plus: 'Fandom Plus', ultra: 'Fandom Ultra' };

/**
 * InfinitePay has no recurring billing, so periods are prepaid. Users with an active (not
 * cancelled) subscription ending within `daysBefore` days get ONE reminder per period.
 * Returns the emails to enqueue; rows are marked in the same transaction (no duplicates).
 */
export async function collectRenewalReminders(
  client: pg.ClientBase,
  opts: { daysBefore: number; appUrl: string },
): Promise<EmailJobData[]> {
  await client.query('BEGIN');
  try {
    const { rows } = await client.query<{
      id: string; email: string; locale: Locale; timezone: string; plan_code: string;
      current_period_end: Date; amount_minor: number; currency: string;
    }>(
      `SELECT s.id, u.email, p.locale, p.timezone, s.plan_code, s.current_period_end, pp.amount_minor, pp.currency
         FROM subscriptions s
         JOIN users u ON u.id = s.user_id AND u.status = 'active'
         JOIN profiles p ON p.user_id = s.user_id
         JOIN plan_prices pp ON pp.id = s.price_id
        WHERE s.status = 'active' AND NOT s.cancel_at_period_end
          AND s.current_period_end > now()
          AND s.current_period_end <= now() + make_interval(days => $1)
          AND s.renewal_reminder_sent_for IS DISTINCT FROM s.current_period_end
        ORDER BY s.id
        FOR UPDATE OF s SKIP LOCKED
        LIMIT 500`,
      [opts.daysBefore],
    );
    if (rows.length) {
      await client.query(
        'UPDATE subscriptions SET renewal_reminder_sent_for = current_period_end WHERE id = ANY($1::uuid[])',
        [rows.map((r) => r.id)],
      );
    }
    await client.query('COMMIT');
    const base = opts.appUrl.replace(/\/+$/, '');
    return rows.map((r) => ({
      to: r.email,
      template: 'subscription_renewal_reminder',
      locale: r.locale,
      link: `${base}/account/subscription`,
      details: {
        plan: PLAN_NAMES[r.plan_code] ?? r.plan_code,
        until: new Intl.DateTimeFormat(r.locale, { dateStyle: 'long', timeZone: r.timezone }).format(r.current_period_end),
        amount: formatMoney(r.amount_minor, r.currency, r.locale),
      },
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
