import type { INestApplication } from '@nestjs/common';
import type { EmailJobData } from '@fandom/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { captureMail, configureTestEnv, onboardingBody, PASSWORD, register, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('Admin panel', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;
  let mail: EmailJobData[];
  let admin: TestUser;
  let support: TestUser;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function staff(role: 'admin' | 'support'): Promise<TestUser> {
    const u = await register(app);
    await db.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [u.id, role]);
    const { UsersService } = await import('../src/auth/users.service.js');
    await app.get(UsersService).invalidate(u.id);
    return u;
  }
  async function member(name = 'Membro Teste'): Promise<TestUser> {
    const u = await register(app);
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody({ displayName: name })).expect(201);
    return u;
  }
  const planOf = async (u: TestUser) => (await http.get('/v1/me').set(bearer(u.token))).body.subscription;

  beforeAll(async () => {
    configureTestEnv();
    const { createApp } = await import('../src/bootstrap.js');
    const { DatabaseService } = await import('../src/database/database.service.js');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DatabaseService);
    http = request(app.getHttpServer());
    mail = await captureMail(app);
    admin = await staff('admin');
    support = await staff('support');
  });
  afterAll(async () => {
    await app?.close();
  });

  it('is restricted to staff; support can view but not change', async () => {
    const u = await member();
    expect((await http.get('/v1/admin/users').set(bearer(u.token)).expect(403)).body.code).toBe('insufficient_role');
    await http.get('/v1/admin/users').expect(401);
    await http.get('/v1/admin/stats').set(bearer(support.token)).expect(200);
    await http.get('/v1/admin/users').set(bearer(support.token)).expect(200);
    const denied = await http.post(`/v1/admin/users/${u.id}/grant-plan`).set(bearer(support.token)).send({ planCode: 'plus', days: 30, reason: 'teste' }).expect(403);
    expect(denied.body.code).toBe('insufficient_role');
  });

  it('lists users with search, filters and cursor pagination', async () => {
    const a = await member('Hermione Busca');
    const res = await http.get('/v1/admin/users?search=hermione%20busca').set(bearer(admin.token)).expect(200);
    expect(res.body.items.map((x: { id: string }) => x.id)).toContain(a.id);
    const row = res.body.items.find((x: { id: string }) => x.id === a.id);
    expect(row).toMatchObject({ email: a.email, displayName: 'Hermione Busca', onboardingCompleted: true, plan: { planCode: 'free', status: 'free' } });
    expect((await http.get(`/v1/admin/users?search=${encodeURIComponent(a.email.toUpperCase())}`).set(bearer(admin.token))).body.items).toHaveLength(1);
    // SQL wildcards in the search are literal.
    expect((await http.get('/v1/admin/users?search=%25').set(bearer(admin.token))).body.items).toHaveLength(0);

    const p1 = (await http.get('/v1/admin/users?limit=2').set(bearer(admin.token)).expect(200)).body;
    expect(p1.items).toHaveLength(2);
    const p2 = (await http.get(`/v1/admin/users?limit=2&cursor=${p1.nextCursor}`).set(bearer(admin.token)).expect(200)).body;
    expect(p2.items.map((x: { id: string }) => x.id)).not.toContain(p1.items[0].id);
    await http.get('/v1/admin/users?cursor=garbage').set(bearer(admin.token)).expect(422);
  });

  it('grants a plan, extends it, switches it, and emails the user', async () => {
    const u = await member();
    const g1 = await http.post(`/v1/admin/users/${u.id}/grant-plan`).set(bearer(admin.token)).send({ planCode: 'plus', days: 30, reason: 'Cortesia de lançamento' }).expect(200);
    expect(g1.body.plan).toMatchObject({ planCode: 'plus', status: 'active', provider: 'manual', interval: null });
    expect((await planOf(u)).planCode).toBe('plus');
    const end1 = new Date(g1.body.plan.currentPeriodEnd).getTime();
    expect((end1 - Date.now()) / 86_400_000).toBeCloseTo(30, 0);

    const g2 = await http.post(`/v1/admin/users/${u.id}/grant-plan`).set(bearer(admin.token)).send({ planCode: 'plus', days: 10, reason: 'Extensão' }).expect(200);
    expect((new Date(g2.body.plan.currentPeriodEnd).getTime() - end1) / 86_400_000).toBeCloseTo(10, 0);

    const g3 = await http.post(`/v1/admin/users/${u.id}/grant-plan`).set(bearer(admin.token)).send({ planCode: 'ultra', days: 365, reason: 'Upgrade manual' }).expect(200);
    expect(g3.body.plan.planCode).toBe('ultra');
    expect((await planOf(u)).planCode).toBe('ultra');
    expect(g3.body.history.map((h: { reason: string }) => h.reason)).toEqual(['admin_grant', 'replaced_by_admin_grant', 'admin_grant', 'admin_grant']);
    expect(g3.body.audit.filter((a: { action: string }) => a.action === 'admin.plan_granted')).toHaveLength(3);
    expect(g3.body.audit[0]).toMatchObject({ actor: admin.email, metadata: { plan: 'ultra', days: 365, reason: 'Upgrade manual' } });
    expect([...mail].reverse().find((m) => m.to === u.email)).toMatchObject({ template: 'subscription_activated', details: { plan: 'Fandom Ultra' } });

    await http.post(`/v1/admin/users/${u.id}/grant-plan`).set(bearer(admin.token)).send({ planCode: 'plus', days: 0, reason: 'x' }).expect(422);
    await http.post(`/v1/admin/users/${u.id}/grant-plan`).set(bearer(admin.token)).send({ planCode: 'plus', days: 5, reason: '' }).expect(422);
  });

  it('revokes premium access immediately (unpaid) and keeps a free account', async () => {
    const u = await member();
    await http.post(`/v1/admin/users/${u.id}/grant-plan`).set(bearer(admin.token)).send({ planCode: 'plus', days: 30, reason: 'pagamento por fora' }).expect(200);
    const r = await http.post(`/v1/admin/users/${u.id}/revoke-plan`).set(bearer(admin.token)).send({ reason: 'Não renovou o pagamento' }).expect(200);
    expect(r.body.plan).toMatchObject({ planCode: 'free', status: 'free' });
    expect((await planOf(u)).planCode).toBe('free');
    await http.get('/v1/me').set(bearer(u.token)).expect(200);
    expect((await http.post(`/v1/admin/users/${u.id}/revoke-plan`).set(bearer(admin.token)).send({ reason: 'de novo' }).expect(404)).body.code).toBe('no_active_subscription');
    const filtered = (await http.get('/v1/admin/users?plan=plus').set(bearer(admin.token))).body.items.map((x: { id: string }) => x.id);
    expect(filtered).not.toContain(u.id);
  });

  it('suspends and reactivates whole accounts, revoking sessions', async () => {
    const u = await member();
    await http.post(`/v1/admin/users/${u.id}/suspend`).set(bearer(admin.token)).send({ reason: 'Fraude no pagamento' }).expect(200);
    expect((await http.get('/v1/me').set(bearer(u.token)).expect(401)).body.code).toBe('session_revoked');
    expect((await http.post('/v1/auth/login').send({ email: u.email, password: PASSWORD }).expect(403)).body.code).toBe('account_suspended');
    expect((await http.get('/v1/admin/users?status=suspended').set(bearer(admin.token))).body.items.map((x: { id: string }) => x.id)).toContain(u.id);

    await http.post(`/v1/admin/users/${u.id}/reactivate`).set(bearer(admin.token)).send({ reason: 'Resolvido' }).expect(200);
    await http.post('/v1/auth/login').send({ email: u.email, password: PASSWORD }).expect(200);
    expect((await http.post(`/v1/admin/users/${admin.id}/suspend`).set(bearer(admin.token)).send({ reason: 'teste' }).expect(403)).body.code).toBe('cannot_suspend_self');
    await http.post('/v1/admin/users/00000000-0000-0000-0000-000000000000/suspend').set(bearer(admin.token)).send({ reason: 'teste' }).expect(404);
  });

  it('computes the same effective plan as the entitlement rules', async () => {
    const { entitledPlan } = await import('../src/subscriptions/entitlements.service.js');
    const cases = [
      { status: 'active', end: 5, grace: null }, { status: 'active', end: -1, grace: null },
      { status: 'past_due', end: -1, grace: 2 }, { status: 'past_due', end: -5, grace: -1 },
      { status: 'cancelled', end: 3, grace: null }, { status: 'cancelled', end: -1, grace: null },
    ] as const;
    for (const c of cases) {
      const u = await member();
      const day = 86_400_000;
      const end = new Date(Date.now() + c.end * day);
      const grace = c.grace === null ? null : new Date(Date.now() + c.grace * day);
      await db.query(
        `INSERT INTO subscriptions (user_id, plan_code, price_id, status, provider, current_period_end, grace_until)
         SELECT $1, 'plus', id, $2, 'manual', $3, $4 FROM plan_prices WHERE plan_code = 'plus' AND billing_interval = 'month' AND currency = 'BRL'`,
        [u.id, c.status, end, grace],
      );
      const viaSql = (await http.get(`/v1/admin/users/${u.id}`).set(bearer(admin.token)).expect(200)).body.plan.planCode;
      const viaTs = entitledPlan({ plan_code: 'plus', status: c.status, billing_interval: 'month', current_period_end: end, grace_until: grace, cancel_at_period_end: false }, new Date());
      expect(viaSql, JSON.stringify(c)).toBe(viaTs);
    }
  });

  it('reports dashboard stats', async () => {
    const s = (await http.get('/v1/admin/stats').set(bearer(admin.token)).expect(200)).body;
    expect(s.users.total).toBeGreaterThan(5);
    expect(s.subscribers.ultra).toBeGreaterThanOrEqual(1);
    expect(s.revenue.currency).toBe('BRL');
  });
});
