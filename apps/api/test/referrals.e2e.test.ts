import type { INestApplication } from '@nestjs/common';
import type { EmailJobData } from '@fandom/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureMail, configureTestEnv, onboardingBody, register, tokenFrom, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('Invite-a-friend program', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;
  let ip: import('../src/billing/infinitepay.client.js').InfinitePayClient;
  let mail: EmailJobData[];
  let createLink: ReturnType<typeof vi.spyOn>;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const email = () => `ref-${Math.random().toString(36).slice(2, 10)}@example.test`;

  async function verify(u: TestUser): Promise<void> {
    const link = [...mail].reverse().find((m) => m.to === u.email)!.link;
    await http.post('/v1/auth/email-verification/confirm').send({ token: tokenFrom(link) }).expect(204);
  }
  /** Verified, onboarded adult (can buy). */
  async function customer(extra: Record<string, unknown> = {}): Promise<TestUser> {
    const u = await register(app, email(), extra);
    await verify(u);
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody()).expect(201);
    return u;
  }
  /** A friend who signs up through the code; `qualify` = verifies email and joins a universe. */
  async function friend(code: string, qualify = true): Promise<TestUser> {
    const u = await register(app, email(), { referralCode: code });
    if (!qualify) return u;
    await verify(u);
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody()).expect(201);
    await http.post('/v1/universes/marvel/membership').set(bearer(u.token)).expect(201);
    return u;
  }

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
  });

  it('gives every user a stable invite link', async () => {
    const u = await customer();
    await http.get('/v1/me/referrals').expect(401);
    const a = (await http.get('/v1/me/referrals').set(bearer(u.token)).expect(200)).body;
    expect(a.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(a.link).toBe(`https://fandom.test/convite/${a.code}`);
    expect(a).toMatchObject({ qualified: 0, pending: 0, discountPercent: 0, nextTier: { min: 3, percent: 5 }, friends: [] });
    expect((await http.get('/v1/me/referrals').set(bearer(u.token)).expect(200)).body.code).toBe(a.code);
  });

  it('counts only friends who verified the email and joined a universe, and discounts checkout', async () => {
    const host = await customer();
    const { code } = (await http.get('/v1/me/referrals').set(bearer(host.token))).body;

    // Unknown and malformed codes never block a sign-up.
    await register(app, email(), { referralCode: 'ZZZZZZZZ' });
    await request(app.getHttpServer()).post('/v1/auth/register').send({ email: email(), password: 'Senha123forte', referralCode: 'x!' }).expect(422);

    await friend(code, false); // signed up only: pending
    for (let i = 0; i < 2; i++) await friend(code);
    let r = (await http.get('/v1/me/referrals').set(bearer(host.token))).body;
    expect(r).toMatchObject({ qualified: 2, pending: 1, discountPercent: 0 });
    expect(JSON.stringify(r.friends)).not.toContain('@example.test'); // friends' emails are never exposed

    await friend(code);
    r = (await http.get('/v1/me/referrals').set(bearer(host.token))).body;
    expect(r).toMatchObject({ qualified: 3, discountPercent: 5, nextTier: { min: 5, percent: 10 } });

    // Checkout charges the discounted price, keeping the list price for the record.
    await http.post('/v1/billing/checkout').set(bearer(host.token)).send({ planCode: 'plus', interval: 'month' }).expect(201);
    const arg = createLink.mock.calls.at(-1)![0] as { amountMinor: number; description: string };
    expect(arg.amountMinor).toBe(2841); // R$ 29,90 - 5%
    expect(arg.description).toContain('(-5%)');
    const pay = await db.one<{ amount_minor: number; list_amount_minor: number; discount_percent: number }>(
      'SELECT amount_minor, list_amount_minor, discount_percent FROM payment_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [host.id]);
    expect(pay).toEqual({ amount_minor: 2841, list_amount_minor: 2990, discount_percent: 5 });

    // A friend can only be referred once; an existing account cannot be referred later.
    const already = (await http.get('/v1/me/referrals').set(bearer(host.token))).body.friends.length;
    expect(already).toBe(4);
  });

  it('lets staff revoke fraudulent referrals, which stop counting at once', async () => {
    const host = await customer();
    const { code } = (await http.get('/v1/me/referrals').set(bearer(host.token))).body;
    for (let i = 0; i < 5; i++) await friend(code);
    expect((await http.get('/v1/me/referrals').set(bearer(host.token))).body.discountPercent).toBe(10);

    const { UsersService } = await import('../src/auth/users.service.js');
    const staff = async (role: 'admin' | 'support') => {
      const u = await customer();
      await db.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [u.id, role]);
      await app.get(UsersService).invalidate(u.id);
      return u;
    };
    const support = await staff('support');
    const admin = await staff('admin');

    await http.get(`/v1/admin/users/${host.id}/referrals`).set(bearer(host.token)).expect(403);
    const list = (await http.get(`/v1/admin/users/${host.id}/referrals`).set(bearer(support.token)).expect(200)).body;
    expect(list.discountPercent).toBe(10);
    expect(list.items).toHaveLength(5);
    const target = list.items[0].id;
    await http.post(`/v1/admin/referrals/${target}/revoke`).set(bearer(support.token)).send({ reason: 'conta falsa' }).expect(403);
    await http.post(`/v1/admin/referrals/${target}/revoke`).set(bearer(admin.token)).send({ reason: 'conta falsa' }).expect(204);
    await http.post(`/v1/admin/referrals/${target}/revoke`).set(bearer(admin.token)).send({ reason: 'conta falsa' }).expect(404);

    const r = (await http.get('/v1/me/referrals').set(bearer(host.token))).body;
    expect(r).toMatchObject({ qualified: 4, discountPercent: 5 });
    expect(r.friends.filter((f: { status: string }) => f.status === 'revoked')).toHaveLength(1);
    const audit = await db.one<{ n: number }>("SELECT count(*)::int AS n FROM audit_logs WHERE action = 'admin.referral_revoked' AND target_id = $1", [host.id]);
    expect(audit!.n).toBe(1);
  });
});
