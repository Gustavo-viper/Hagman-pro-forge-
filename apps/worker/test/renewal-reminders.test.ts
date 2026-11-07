import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderEmail } from '../src/jobs/email.js';
import { collectRenewalReminders } from '../src/jobs/renewal-reminders.js';

const url = process.env.TEST_DATABASE_URL;

describe('billing email templates', () => {
  it('renders activation and reminder emails with details', () => {
    const r = renderEmail({ to: 'a@b.test', template: 'subscription_activated', locale: 'pt-BR', link: 'https://x.test/account/subscription', details: { plan: 'Fandom Plus (mensal)', until: '7 de dezembro de 2026', amount: 'R$ 14,90' } });
    expect(r.subject).toBe('Pagamento confirmado — Fandom Universe');
    expect(r.text).toContain('R$ 14,90');
    expect(r.text).toContain('7 de dezembro de 2026');
    expect(r.text).not.toContain('expira');
  });
});

describe.runIf(Boolean(url))('renewal reminders job', () => {
  const client = new pg.Client({ connectionString: url });
  beforeAll(() => client.connect());
  afterAll(() => client.end());

  async function sub(daysLeft: number, opts: { cancelled?: boolean } = {}) {
    const { rows } = await client.query<{ id: string }>('INSERT INTO users (email) VALUES ($1) RETURNING id', [`${randomUUID()}@t.test`]);
    await client.query("INSERT INTO profiles (user_id, locale, timezone) VALUES ($1, 'pt-BR', 'America/Sao_Paulo')", [rows[0]!.id]);
    const s = await client.query<{ id: string }>(
      `INSERT INTO subscriptions (user_id, plan_code, price_id, status, provider, current_period_start, current_period_end, cancel_at_period_end)
       SELECT $1, 'plus', id, $2, 'infinitepay', now() - interval '20 days', now() + make_interval(days => $3), $4
         FROM plan_prices WHERE plan_code = 'plus' AND billing_interval = 'month' AND currency = 'BRL' RETURNING id`,
      [rows[0]!.id, opts.cancelled ? 'cancelled' : 'active', daysLeft, Boolean(opts.cancelled)],
    );
    return s.rows[0]!.id;
  }

  it('reminds once per period, only active non-cancelled subscriptions ending soon', async () => {
    await client.query('DELETE FROM subscriptions');
    await sub(2);
    await sub(10);
    await sub(1, { cancelled: true });
    const first = await collectRenewalReminders(client, { daysBefore: 3, appUrl: 'https://fandom.test/' });
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ template: 'subscription_renewal_reminder', link: 'https://fandom.test/account/subscription' });
    expect(first[0]!.details?.amount?.replace(/\s/g, ' ')).toBe('R$ 14,90');
    expect(await collectRenewalReminders(client, { daysBefore: 3, appUrl: 'https://fandom.test' })).toHaveLength(0);
  });
});
