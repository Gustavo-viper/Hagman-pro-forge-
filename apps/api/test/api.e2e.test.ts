import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureTestEnv, makeUser, onboardingBody } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('Fandom API (PostgreSQL + Redis)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;

  beforeAll(async () => {
    configureTestEnv();
    const { createApp } = await import('../src/bootstrap.js');
    const { DatabaseService } = await import('../src/database/database.service.js');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DatabaseService);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('health', () => {
    it('GET /health is public and unversioned', async () => {
      const res = await http.get('/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', service: 'fandom-api' });
      expect(res.headers['x-request-id']).toBeTruthy();
    });

    it('GET /health/ready checks the database and redis', async () => {
      const res = await http.get('/health/ready').expect(200);
      expect(res.body.checks.database.status).toBe('ok');
      if (process.env.TEST_REDIS_URL) expect(res.body.checks.redis.status).toBe('ok');
    });

    it('sets security headers', async () => {
      const res = await http.get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('public catalog', () => {
    it('lists active universes with theme tokens', async () => {
      const res = await http.get('/v1/universes').expect(200);
      expect(res.body.items.map((u: { slug: string }) => u.slug)).toEqual(['harry-potter', 'supernatural']);
      expect(res.body.items[0].theme.primary).toMatch(/^#/);
    });

    it('returns a universe with identity config (houses)', async () => {
      const res = await http.get('/v1/universes/harry-potter').expect(200);
      expect(res.body.identityConfig.options).toHaveLength(4);
    });

    it('404s unknown universes and rejects invalid slugs', async () => {
      const nf = await http.get('/v1/universes/star-gate').expect(404);
      expect(nf.body.code).toBe('universe_not_found');
      const bad = await http.get('/v1/universes/Bad_Slug!').expect(422);
      expect(bad.body.code).toBe('validation_failed');
    });

    it('lists plans with BRL prices and no invented currencies', async () => {
      const res = await http.get('/v1/subscription-plans').expect(200);
      const plus = res.body.items.find((p: { code: string }) => p.code === 'plus');
      expect(plus.prices).toEqual([
        { interval: 'month', currency: 'BRL', amountMinor: 1490 },
        { interval: 'year', currency: 'BRL', amountMinor: 14990 },
      ]);
      const usd = await http.get('/v1/subscription-plans?currency=usd').expect(200);
      expect(usd.body.currency).toBe('USD');
      expect(usd.body.items.every((p: { prices: unknown[] }) => p.prices.length === 0)).toBe(true);
    });
  });

  describe('authentication', () => {
    it('rejects missing, malformed, expired, forged and non-authenticated tokens', async () => {
      expect((await http.get('/v1/me').expect(401)).body.code).toBe('unauthorized');
      expect((await http.get('/v1/me').set('Authorization', 'Bearer abc').expect(401)).body.code).toBe('invalid_token');
      const expired = await makeUser({ expiresIn: '-1m' });
      expect((await http.get('/v1/me').set('Authorization', `Bearer ${expired.token}`).expect(401)).body.code).toBe('token_expired');
      const forged = await makeUser({ secret: 'another-secret-that-is-at-least-32-chars-long' });
      await http.get('/v1/me').set('Authorization', `Bearer ${forged.token}`).expect(401);
      const anon = await makeUser({ role: 'anon' });
      await http.get('/v1/me').set('Authorization', `Bearer ${anon.token}`).expect(401);
    });

    it('creates the user + profile on first request', async () => {
      const u = await makeUser();
      const res = await http.get('/v1/me').set('Authorization', `Bearer ${u.token}`).expect(200);
      expect(res.body.profile).toMatchObject({ id: u.id, email: u.email, onboardingCompleted: false, roles: [] });
      expect(res.body.subscription).toEqual({
        planCode: 'free', status: 'free', interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false,
      });
    });

    it('blocks suspended accounts', async () => {
      const u = await makeUser();
      await http.get('/v1/me').set('Authorization', `Bearer ${u.token}`).expect(200);
      await db.query("UPDATE users SET status = 'suspended' WHERE id = $1", [u.id]);
      const { UsersService } = await import('../src/auth/users.service.js');
      await app.get(UsersService).invalidate(u.id);
      const res = await http.get('/v1/me').set('Authorization', `Bearer ${u.token}`).expect(403);
      expect(res.body.code).toBe('account_suspended');
    });
  });

  describe('onboarding', () => {
    it('completes onboarding, records consent, awards XP exactly once', async () => {
      const u = await makeUser();
      const auth = { Authorization: `Bearer ${u.token}` };
      const body = onboardingBody();
      const res = await http.post('/v1/me/onboarding').set(auth).send(body).expect(201);
      expect(res.body.profile).toMatchObject({ username: body.username, onboardingCompleted: true, isMinor: false });

      const again = await http.post('/v1/me/onboarding').set(auth).send(body).expect(409);
      expect(again.body.code).toBe('onboarding_already_completed');

      const consents = await db.query('SELECT consent_type, granted FROM user_consents WHERE user_id = $1 ORDER BY consent_type', [u.id]);
      expect(consents.rows).toEqual([
        { consent_type: 'marketing_email', granted: true },
        { consent_type: 'privacy_policy', granted: true },
        { consent_type: 'terms_of_use', granted: true },
      ]);
      const dash = await http.get('/v1/me/dashboard').set(auth).expect(200);
      expect(dash.body.xp).toMatchObject({ total: 50, level: 1, nextLevelXp: 100 });
      const audit = await db.query("SELECT 1 FROM audit_logs WHERE actor_user_id = $1 AND action = 'user.onboarding_completed'", [u.id]);
      expect(audit.rowCount).toBe(1);
    });

    it('rejects duplicate usernames with a stable code', async () => {
      const a = await makeUser();
      const b = await makeUser();
      const body = onboardingBody();
      await http.post('/v1/me/onboarding').set('Authorization', `Bearer ${a.token}`).send(body).expect(201);
      const avail = await http.get(`/v1/me/username-availability?username=${body.username}`).set('Authorization', `Bearer ${b.token}`).expect(200);
      expect(avail.body.available).toBe(false);
      const res = await http.post('/v1/me/onboarding').set('Authorization', `Bearer ${b.token}`).send(body).expect(409);
      expect(res.body.code).toBe('username_taken');
    });

    it('applies protected-minor defaults and blocks under-13 users', async () => {
      const teen = await makeUser();
      const year = new Date().getUTCFullYear();
      const res = await http
        .post('/v1/me/onboarding')
        .set('Authorization', `Bearer ${teen.token}`)
        .send(onboardingBody({ birthdate: `${year - 15}-01-01`, marketingEmail: true }))
        .expect(201);
      expect(res.body.profile.isMinor).toBe(true);
      const row = await db.one<{ privacy: Record<string, unknown> }>('SELECT privacy FROM profiles WHERE user_id = $1', [teen.id]);
      expect(row?.privacy).toMatchObject({ profileVisibility: 'members', allowMessagesFrom: 'friends' });
      const mk = await db.one<{ granted: boolean }>("SELECT granted FROM user_consents WHERE user_id = $1 AND consent_type = 'marketing_email'", [teen.id]);
      expect(mk?.granted).toBe(false);

      const child = await makeUser();
      const blocked = await http
        .post('/v1/me/onboarding')
        .set('Authorization', `Bearer ${child.token}`)
        .send(onboardingBody({ birthdate: `${year - 10}-01-01` }))
        .expect(403);
      expect(blocked.body.code).toBe('age_restricted');
    });

    it('validates input and requires legal acceptance', async () => {
      const u = await makeUser();
      const res = await http
        .post('/v1/me/onboarding')
        .set('Authorization', `Bearer ${u.token}`)
        .send(onboardingBody({ acceptTerms: false, username: 'x' }))
        .expect(422);
      expect(res.body.code).toBe('validation_failed');
      expect(res.body.details.map((d: { path: string }) => d.path).sort()).toEqual(['acceptTerms', 'username']);
    });

    it('updates preferences', async () => {
      const u = await makeUser();
      const res = await http.patch('/v1/me/preferences').set('Authorization', `Bearer ${u.token}`).send({ locale: 'en' }).expect(200);
      expect(res.body.profile.locale).toBe('en');
      await http.patch('/v1/me/preferences').set('Authorization', `Bearer ${u.token}`).send({}).expect(422);
    });
  });

  describe('universe membership', () => {
    it('requires onboarding, then joins idempotently and leaves', async () => {
      const u = await makeUser();
      const auth = { Authorization: `Bearer ${u.token}` };
      const blocked = await http.post('/v1/universes/supernatural/membership').set(auth).expect(403);
      expect(blocked.body.code).toBe('onboarding_required');

      await http.post('/v1/me/onboarding').set(auth).send(onboardingBody()).expect(201);
      const before = (await http.get('/v1/universes/supernatural')).body.memberCount;
      const joined = await http.post('/v1/universes/supernatural/membership').set(auth).expect(201);
      expect(joined.body).toMatchObject({ slug: 'supernatural', xp: 0, level: 1 });
      await http.post('/v1/universes/supernatural/membership').set(auth).expect(201);
      expect((await http.get('/v1/universes/supernatural')).body.memberCount).toBe(before + 1);

      const dash = await http.get('/v1/me/dashboard').set(auth).expect(200);
      expect(dash.body.memberships.map((m: { slug: string }) => m.slug)).toEqual(['supernatural']);

      await http.delete('/v1/universes/supernatural/membership').set(auth).expect(204);
      await http.delete('/v1/universes/supernatural/membership').set(auth).expect(404);
      expect((await http.get('/v1/universes/supernatural')).body.memberCount).toBe(before);
    });
  });

  describe('super admin bootstrap', () => {
    it('grants super_admin once to a verified bootstrap email only', async () => {
      const unverified = await makeUser({ email: 'founder@forge.test', verified: false });
      expect((await http.get('/v1/me').set('Authorization', `Bearer ${unverified.token}`)).body.profile.roles).toEqual([]);
      await db.query('DELETE FROM users WHERE id = $1', [unverified.id]);

      const founder = await makeUser({ email: 'founder@forge.test' });
      expect((await http.get('/v1/me').set('Authorization', `Bearer ${founder.token}`)).body.profile.roles).toEqual(['super_admin']);
      await db.query('DELETE FROM users WHERE id = $1', [founder.id]);
      // A second account with the same email cannot bootstrap again while a super_admin exists.
      await db.query("INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'other@x.test')");
      await db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'super_admin' FROM users WHERE email = 'other@x.test'");
      const again = await makeUser({ email: 'founder@forge.test' });
      expect((await http.get('/v1/me').set('Authorization', `Bearer ${again.token}`)).body.profile.roles).toEqual([]);
    });
  });

  describe('errors', () => {
    it('returns the uniform envelope for unknown routes and bad JSON', async () => {
      const nf = await http.get('/v1/does-not-exist').expect(404);
      expect(nf.body).toMatchObject({ statusCode: 404, code: 'not_found' });
      const u = await makeUser();
      const res = await http
        .post('/v1/me/onboarding')
        .set('Authorization', `Bearer ${u.token}`)
        .set('Content-Type', 'application/json')
        .send('{bad json')
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, code: 'bad_request' });
      expect(JSON.stringify(res.body)).not.toMatch(/stack|at /);
    });
  });
});
