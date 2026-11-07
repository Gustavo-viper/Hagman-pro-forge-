import type { INestApplication } from '@nestjs/common';
import type { EmailJobData } from '@fandom/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureMail, configureTestEnv, onboardingBody, register, tokenFrom, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const WEBHOOK = '/v1/billing/webhooks/infinitepay?token=webhook-token-for-tests-0123456789';

describe.runIf(enabled)('Billing (InfinitePay)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;
  let ip: import('../src/billing/infinitepay.client.js').InfinitePayClient;
  let mail: EmailJobData[];
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  /** Registered, email-verified and onboarded adult. */
  async function customer(overrides: Record<string, unknown> = {}): Promise<TestUser> {
    const u = await register(app);
    const link = [...mail].reverse().find((m) => m.to === u.email)!.link;
    await http.post('/v1/auth/email-verification/confirm').send({ token: tokenFrom(link) }).expect(204);
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody(overrides)).expect(201);
    return u;
  }

  let createLink: ReturnType<typeof vi.spyOn>;
  let paymentCheck: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    configureTestEnv();
    const { createApp } = await import('../src/bootstrap.js');
    const { DatabaseService } = await import('../src/database/database.service.js');
    const { InfinitePayClient } = await import('../src/billing/infinitepay.client.js');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DatabaseService);
    ip = app.get(InfinitePayClient);
    http = request(app.getHttpServer());
    mail = await captureMail(app);
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    createLink = vi.spyOn(ip, 'createLink').mockImplementation(async (i) => `https://checkout.infinitepay.io/fandomtest/${i.orderNsu}`);
    paymentCheck = vi.spyOn(ip, 'paymentCheck').mockResolvedValue({ success: true, paid: false, amount: null, paidAmount: null, installments: null, captureMethod: null });
  });

  const paid = (amount: number) =>
    paymentCheck.mockResolvedValue({ success: true, paid: true, amount, paidAmount: amount, installments: 1, captureMethod: 'pix' });

  it('exposes billing config', async () => {
    expect((await http.get('/v1/billing/config').expect(200)).body).toEqual({ enabled: true, provider: 'infinitepay', currency: 'BRL', autoRenew: false });
  });

  it('requires onboarding, verified email and adult users', async () => {
    const fresh = await register(app);
    expect((await http.post('/v1/billing/checkout').set(bearer(fresh.token)).send({ planCode: 'plus', interval: 'month' }).expect(403)).body.code).toBe('onboarding_required');
    await http.post('/v1/me/onboarding').set(bearer(fresh.token)).send(onboardingBody()).expect(201);
    expect((await http.post('/v1/billing/checkout').set(bearer(fresh.token)).send({ planCode: 'plus', interval: 'month' }).expect(403)).body.code).toBe('email_not_verified');
    const teen = await customer({ birthdate: `${new Date().getUTCFullYear() - 16}-01-01` });
    expect((await http.post('/v1/billing/checkout').set(bearer(teen.token)).send({ planCode: 'plus', interval: 'month' }).expect(403)).body.code).toBe('minor_purchase_blocked');
    await http.post('/v1/billing/checkout').set(bearer(teen.token)).send({ planCode: 'free', interval: 'month' }).expect(422);
  });

  it('creates a single-use, expiring checkout link with the exact price and reuses it', async () => {
    const u = await customer();
    const res = await http.post('/v1/billing/checkout').set(bearer(u.token)).send({ planCode: 'plus', interval: 'year' }).expect(201);
    expect(res.body.checkoutUrl).toMatch(/^https:\/\/checkout\.infinitepay\.io\/fandomtest\/fu_/);
    const arg = createLink.mock.calls[0]![0] as import('../src/billing/infinitepay.client.js').CreateLinkInput;
    expect(arg).toMatchObject({ amountMinor: 14990, description: 'Fandom Plus — anual', redirectUrl: 'https://fandom.test/account/subscription', customer: { email: u.email } });
    expect(arg.webhookUrl).toBe(`https://api.fandom.test${WEBHOOK}`);
    expect(arg.validUntil.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    const again = await http.post('/v1/billing/checkout').set(bearer(u.token)).send({ planCode: 'plus', interval: 'year' }).expect(201);
    expect(again.body.orderNsu).toBe(res.body.orderNsu);
    expect(createLink).toHaveBeenCalledTimes(1);
  });

  it('never activates from the redirect alone: only after payment_check confirms', async () => {
    const u = await customer();
    const { orderNsu } = (await http.post('/v1/billing/checkout').set(bearer(u.token)).send({ planCode: 'plus', interval: 'month' })).body;
    const ret = { orderNsu, transactionNsu: 'tx-1', slug: 'inv-1' };

    const pending = await http.post('/v1/billing/confirm').set(bearer(u.token)).send(ret).expect(200);
    expect(pending.body).toMatchObject({ status: 'pending', subscription: { planCode: 'free' } });

    paid(1490);
    const ok = await http.post('/v1/billing/confirm').set(bearer(u.token)).send(ret).expect(200);
    expect(ok.body.status).toBe('paid');
    expect(ok.body.subscription).toMatchObject({ planCode: 'plus', status: 'active', interval: 'month', cancelAtPeriodEnd: false });
    const days = (new Date(ok.body.subscription.currentPeriodEnd).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);
    expect(paymentCheck).toHaveBeenLastCalledWith({ orderNsu, transactionNsu: 'tx-1', slug: 'inv-1' });

    // Idempotent: confirm again + webhook replay do not extend the period twice.
    await http.post('/v1/billing/confirm').set(bearer(u.token)).send(ret).expect(200);
    const hook = await http.post(WEBHOOK).send({ order_nsu: orderNsu, transaction_nsu: 'tx-1', invoice_slug: 'inv-1', amount: 1490 }).expect(200);
    expect(hook.body.outcome).toBe('already_paid');
    const subs = await db.query('SELECT current_period_end FROM subscriptions WHERE user_id = $1', [u.id]);
    expect(subs.rows).toHaveLength(1);
    expect(subs.rows[0]!.current_period_end.toISOString()).toBe(ok.body.subscription.currentPeriodEnd);

    const m = [...mail].reverse().find((x) => x.to === u.email)!;
    expect(m).toMatchObject({ template: 'subscription_activated', locale: 'pt-BR', details: { plan: 'Fandom Plus (mensal)' } });
    // Someone else cannot confirm this order.
    const other = await customer();
    await http.post('/v1/billing/confirm').set(bearer(other.token)).send(ret).expect(404);
  });

  it('processes verified webhooks, renews by extending the paid period, and ignores junk', async () => {
    const u = await customer();
    const o1 = (await http.post('/v1/billing/checkout').set(bearer(u.token)).send({ planCode: 'ultra', interval: 'month' })).body.orderNsu;
    paid(2990);
    expect((await http.post(WEBHOOK).send({ order_nsu: o1, transaction_nsu: 'tx-a', invoice_slug: 'inv-a', amount: 2990, receipt_url: 'https://r.test/a' }).expect(200)).body.outcome).toBe('paid');
    const end1 = (await db.one<{ e: Date }>('SELECT current_period_end AS e FROM subscriptions WHERE user_id = $1', [u.id]))!.e;

    const o2 = (await http.post('/v1/billing/checkout').set(bearer(u.token)).send({ planCode: 'ultra', interval: 'month' })).body.orderNsu;
    await http.post(WEBHOOK).send({ order_nsu: o2, transaction_nsu: 'tx-b', invoice_slug: 'inv-b' }).expect(200);
    const end2 = (await db.one<{ e: Date }>('SELECT current_period_end AS e FROM subscriptions WHERE user_id = $1', [u.id]))!.e;
    const extra = (end2.getTime() - end1.getTime()) / 86_400_000;
    expect(extra).toBeGreaterThanOrEqual(28);
    expect(extra).toBeLessThanOrEqual(31);

    const details = (await http.get('/v1/billing/subscription').set(bearer(u.token)).expect(200)).body;
    expect(details.renewablePlan).toBe('ultra');
    expect(details.payments.map((p: { status: string }) => p.status)).toEqual(['paid', 'paid']);
    expect(details.payments[1].receiptUrl).toBe('https://r.test/a');

    expect((await http.post('/v1/billing/webhooks/infinitepay?token=wrong').send({ order_nsu: o1 }).expect(401)).body.code).toBe('invalid_webhook_token');
    expect((await http.post(WEBHOOK).send({ order_nsu: 'nope', transaction_nsu: 'x', invoice_slug: 'y' }).expect(200)).body.outcome).toBe('unknown_order');
    expect((await http.post(WEBHOOK).send({ hello: 'world' }).expect(200)).body.outcome).toBe('ignored_missing_fields');
    const stored = await db.one<{ n: number }>("SELECT count(*)::int AS n FROM payment_webhook_events WHERE provider = 'infinitepay'");
    expect(stored!.n).toBeGreaterThanOrEqual(4);
  });

  it('refuses activation when the provider reports a different amount', async () => {
    const u = await customer();
    const o = (await http.post('/v1/billing/checkout').set(bearer(u.token)).send({ planCode: 'plus', interval: 'month' })).body.orderNsu;
    paid(100);
    expect((await http.post(WEBHOOK).send({ order_nsu: o, transaction_nsu: 'tx-m', invoice_slug: 'inv-m' }).expect(200)).body.outcome).toBe('not_paid');
    expect((await http.get('/v1/me').set(bearer(u.token))).body.subscription.planCode).toBe('free');
  });

  it('asks the provider to retry when payment_check is unreachable', async () => {
    const u = await customer();
    const o = (await http.post('/v1/billing/checkout').set(bearer(u.token)).send({ planCode: 'plus', interval: 'month' })).body.orderNsu;
    const { PaymentProviderError } = await import('../src/billing/infinitepay.client.js');
    paymentCheck.mockRejectedValue(new PaymentProviderError('down'));
    await http.post(WEBHOOK).send({ order_nsu: o, transaction_nsu: 'tx-d', invoice_slug: 'inv-d' }).expect(500);
  });

  it('blocks plan changes mid-period, cancels keeping benefits and reactivates', async () => {
    const u = await customer();
    const o = (await http.post('/v1/billing/checkout').set(bearer(u.token)).send({ planCode: 'plus', interval: 'month' })).body.orderNsu;
    paid(1490);
    await http.post('/v1/billing/confirm').set(bearer(u.token)).send({ orderNsu: o, transactionNsu: 't', slug: 's' }).expect(200);
    expect((await http.post('/v1/billing/checkout').set(bearer(u.token)).send({ planCode: 'ultra', interval: 'month' }).expect(409)).body.code).toBe('plan_change_unavailable');

    const cancelled = (await http.post('/v1/billing/subscription/cancel').set(bearer(u.token)).expect(200)).body;
    expect(cancelled.subscription).toMatchObject({ planCode: 'plus', status: 'cancelled', cancelAtPeriodEnd: true });
    await http.post('/v1/billing/subscription/cancel').set(bearer(u.token)).expect(404);
    const back = (await http.post('/v1/billing/subscription/reactivate').set(bearer(u.token)).expect(200)).body;
    expect(back.subscription).toMatchObject({ status: 'active', cancelAtPeriodEnd: false });
    const hist = await db.query(
      'SELECT to_status FROM subscription_status_history h JOIN subscriptions s ON s.id = h.subscription_id WHERE s.user_id = $1 ORDER BY h.id',
      [u.id],
    );
    expect(hist.rows.map((r) => r.to_status)).toEqual(['active', 'cancelled', 'active']);
  });

  it('reports provider failures without leaking details and marks the payment failed', async () => {
    const u = await customer();
    const { PaymentProviderError } = await import('../src/billing/infinitepay.client.js');
    createLink.mockRejectedValue(new PaymentProviderError('boom', 500));
    expect((await http.post('/v1/billing/checkout').set(bearer(u.token)).send({ planCode: 'plus', interval: 'month' }).expect(502)).body.code).toBe('payment_provider_error');
    expect((await db.one<{ status: string }>('SELECT status FROM payment_transactions WHERE user_id = $1', [u.id]))!.status).toBe('failed');
  });
});

describe.runIf(enabled)('Billing disabled without credentials', () => {
  it('reports disabled and refuses checkout', async () => {
    configureTestEnv({ INFINITEPAY_HANDLE: '', INFINITEPAY_API_KEY: '', INFINITEPAY_WEBHOOK_TOKEN: '' });
    for (const k of ['INFINITEPAY_HANDLE', 'INFINITEPAY_API_KEY', 'INFINITEPAY_WEBHOOK_TOKEN']) delete process.env[k];
    const { createApp } = await import('../src/bootstrap.js');
    const app = await createApp({ logger: false });
    await app.init();
    const http = request(app.getHttpServer());
    expect((await http.get('/v1/billing/config').expect(200)).body.enabled).toBe(false);
    const u = await register(app);
    expect((await http.post('/v1/billing/checkout').set({ Authorization: `Bearer ${u.token}` }).send({ planCode: 'plus', interval: 'month' }).expect(503)).body.code).toBe('billing_unavailable');
    await app.close();
  });
});
