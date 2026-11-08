import type { INestApplication } from '@nestjs/common';
import type { EmailJobData } from '@fandom/shared';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { captureMail, configureTestEnv, onboardingBody, PASSWORD, register, TEST_JWT_SECRET, tokenFrom } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('Fandom API (PostgreSQL + Redis)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;
  let mail: EmailJobData[];
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const lastMailTo = (email: string) => [...mail].reverse().find((m) => m.to === email)!;

  beforeAll(async () => {
    configureTestEnv();
    const { createApp } = await import('../src/bootstrap.js');
    const { DatabaseService } = await import('../src/database/database.service.js');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DatabaseService);
    http = request(app.getHttpServer());
    mail = await captureMail(app);
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
      expect(res.body.items.map((u: { slug: string }) => u.slug)).toEqual(['harry-potter', 'supernatural', 'marvel', 'dc', 'star-wars', 'greys-anatomy', 'station-19', 'bts', 'animes', 'games']);
      expect(res.body.items[0].theme.primary).toMatch(/^#/);
    });

    it('returns a universe with identity config (houses)', async () => {
      const res = await http.get('/v1/universes/harry-potter').expect(200);
      expect(res.body.identityConfig.options).toHaveLength(4);
    });

    it('serves the Marvel, DC and Star Wars universes with their own themes and identities', async () => {
      const sw = await http.get('/v1/universes/star-wars').expect(200);
      expect(sw.body.identityConfig.options.map((o: { key: string }) => o.key)).toContain('jedi');
      expect(sw.body.theme.accent).toBe('#ffe81f');
      expect((await http.get('/v1/universes/marvel').expect(200)).body.identityConfig.options).toHaveLength(5);
      expect((await http.get('/v1/universes/dc').expect(200)).body.features).toContain('multiverse_guide');
    });

    it("serves Grey's Anatomy, Station 19 and BTS (fandom roles, never real people as identities)", async () => {
      const greys = await http.get('/v1/universes/greys-anatomy').expect(200);
      expect(greys.body.name['pt-BR']).toBe("Grey's Anatomy");
      expect(greys.body.identityConfig.options.map((o: { key: string }) => o.key)).toContain('cardio');
      expect((await http.get('/v1/universes/station-19').expect(200)).body.features).toContain('rescue_missions');
      const bts = await http.get('/v1/universes/bts').expect(200);
      expect(bts.body.identityConfig.type).toBe('fandom_role');
      expect(bts.body.description['pt-BR']).toContain('Respeito aos artistas');
    });

    it('404s unknown universes and rejects invalid slugs', async () => {
      expect((await http.get('/v1/universes/star-gate').expect(404)).body.code).toBe('universe_not_found');
      expect((await http.get('/v1/universes/Bad_Slug!').expect(422)).body.code).toBe('validation_failed');
    });

    it('lists plans with BRL prices and no invented currencies', async () => {
      const res = await http.get('/v1/subscription-plans').expect(200);
      const plus = res.body.items.find((p: { code: string }) => p.code === 'plus');
      expect(plus.prices).toEqual([
        { interval: 'month', currency: 'BRL', amountMinor: 1490 },
        { interval: 'year', currency: 'BRL', amountMinor: 14990 },
      ]);
      const usd = await http.get('/v1/subscription-plans?currency=usd').expect(200);
      expect(usd.body.items.every((p: { prices: unknown[] }) => p.prices.length === 0)).toBe(true);
    });
  });

  describe('authentication', () => {
    it('registers, stores only a password hash and sends a verification email', async () => {
      const u = await register(app);
      const cred = await db.one<{ password_hash: string }>('SELECT password_hash FROM auth_credentials WHERE user_id = $1', [u.id]);
      expect(cred?.password_hash.startsWith('scrypt$')).toBe(true);
      expect(cred?.password_hash).not.toContain(PASSWORD);
      const m = lastMailTo(u.email);
      expect(m.template).toBe('email_verification');
      expect(m.link.startsWith('https://fandom.test/verify-email?token=')).toBe(true);
      const me = await http.get('/v1/me').set(bearer(u.token)).expect(200);
      expect(me.body.profile).toMatchObject({ id: u.id, email: u.email, emailVerified: false, onboardingCompleted: false, roles: [] });
      expect(me.body.subscription).toMatchObject({ planCode: 'free', status: 'free' });
    });

    it('rejects duplicate emails (case-insensitive) and weak passwords', async () => {
      const u = await register(app);
      const dup = await http.post('/v1/auth/register').send({ email: u.email.toUpperCase(), password: PASSWORD }).expect(409);
      expect(dup.body.code).toBe('email_taken');
      await http.post('/v1/auth/register').send({ email: 'weak@example.test', password: 'abcdefgh' }).expect(422);
    });

    it('logs in with correct credentials only, without revealing which accounts exist', async () => {
      const u = await register(app);
      const ok = await http.post('/v1/auth/login').send({ email: u.email, password: PASSWORD }).expect(200);
      expect(ok.body).toMatchObject({ expiresIn: 900, user: { id: u.id } });
      const wrong = await http.post('/v1/auth/login').send({ email: u.email, password: 'Errada123' }).expect(401);
      const unknown = await http.post('/v1/auth/login').send({ email: 'ghost@example.test', password: PASSWORD }).expect(401);
      expect(wrong.body.code).toBe('invalid_credentials');
      expect(unknown.body).toMatchObject({ code: wrong.body.code, message: wrong.body.message });
    });

    it.runIf(Boolean(process.env.TEST_REDIS_URL))('locks an account after 10 failed logins', async () => {
      const u = await register(app);
      for (let i = 0; i < 10; i++) await http.post('/v1/auth/login').send({ email: u.email, password: 'Errada123' }).expect(401);
      const locked = await http.post('/v1/auth/login').send({ email: u.email, password: PASSWORD }).expect(429);
      expect(locked.body.code).toBe('too_many_attempts');
    });

    it('rotates refresh tokens and revokes the family when an old one is reused', async () => {
      const u = await register(app);
      const r1 = await http.post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);
      expect(r1.body.refreshToken).not.toBe(u.refreshToken);
      await http.get('/v1/me').set(bearer(r1.body.accessToken)).expect(200);

      const reuse = await http.post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
      expect(reuse.body.code).toBe('refresh_token_reused');
      // The legitimate-looking newer session is gone too (stolen-token defence).
      expect((await http.get('/v1/me').set(bearer(r1.body.accessToken)).expect(401)).body.code).toBe('session_revoked');
      await http.post('/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
    });

    it('logout revokes the access token immediately', async () => {
      const u = await register(app);
      await http.post('/v1/auth/logout').set(bearer(u.token)).expect(204);
      expect((await http.get('/v1/me').set(bearer(u.token)).expect(401)).body.code).toBe('session_revoked');
      await http.post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    });

    it('rejects missing, malformed, expired and forged tokens', async () => {
      const u = await register(app);
      expect((await http.get('/v1/me').expect(401)).body.code).toBe('unauthorized');
      expect((await http.get('/v1/me').set(bearer('abc')).expect(401)).body.code).toBe('invalid_token');
      const sid = (await db.one<{ id: string }>('SELECT id FROM auth_sessions WHERE user_id = $1', [u.id]))!.id;
      const sign = (secret: string, exp: string) =>
        new SignJWT({ sid }).setProtectedHeader({ alg: 'HS256' }).setSubject(u.id).setIssuer('fandom-api')
          .setAudience('fandom-web').setIssuedAt().setExpirationTime(exp).sign(new TextEncoder().encode(secret));
      expect((await http.get('/v1/me').set(bearer(await sign(TEST_JWT_SECRET, '-1m'))).expect(401)).body.code).toBe('token_expired');
      await http.get('/v1/me').set(bearer(await sign('another-secret-that-is-at-least-32-chars!!', '5m'))).expect(401);
      await http.get('/v1/me').set(bearer(await sign(TEST_JWT_SECRET, '5m'))).expect(200);
    });

    it('verifies email with a single-use link', async () => {
      const u = await register(app);
      const token = tokenFrom(lastMailTo(u.email).link);
      await http.post('/v1/auth/email-verification/confirm').send({ token }).expect(204);
      expect((await http.get('/v1/me').set(bearer(u.token))).body.profile.emailVerified).toBe(true);
      const again = await http.post('/v1/auth/email-verification/confirm').send({ token }).expect(400);
      expect(again.body.code).toBe('invalid_or_expired_token');
      expect((await http.post('/v1/auth/email-verification').set(bearer(u.token)).expect(409)).body.code).toBe('email_already_verified');
    });

    it('resets a password, revokes every session and accepts only the new password', async () => {
      const u = await register(app);
      await http.post('/v1/auth/password-reset').send({ email: u.email }).expect(202);
      await http.post('/v1/auth/password-reset').send({ email: 'nobody@example.test' }).expect(202);
      const m = lastMailTo(u.email);
      expect(m.template).toBe('password_reset');
      await http.post('/v1/auth/password-reset/confirm').send({ token: tokenFrom(m.link), password: 'NovaSenha456' }).expect(204);
      await http.get('/v1/me').set(bearer(u.token)).expect(401);
      await http.post('/v1/auth/login').send({ email: u.email, password: PASSWORD }).expect(401);
      await http.post('/v1/auth/login').send({ email: u.email, password: 'NovaSenha456' }).expect(200);
      await http.post('/v1/auth/password-reset/confirm').send({ token: tokenFrom(m.link), password: 'Outra789x' }).expect(400);
    });

    it('blocks suspended accounts', async () => {
      const u = await register(app);
      await db.query("UPDATE users SET status = 'suspended' WHERE id = $1", [u.id]);
      const { UsersService } = await import('../src/auth/users.service.js');
      await app.get(UsersService).invalidate(u.id);
      expect((await http.get('/v1/me').set(bearer(u.token)).expect(403)).body.code).toBe('account_suspended');
      expect((await http.post('/v1/auth/login').send({ email: u.email, password: PASSWORD }).expect(403)).body.code).toBe('account_suspended');
    });

    it('grants super_admin once, when the bootstrap email is verified', async () => {
      const founder = await register(app, 'founder@forge.test');
      expect((await http.get('/v1/me').set(bearer(founder.token))).body.profile.roles).toEqual([]);
      await http.post('/v1/auth/email-verification/confirm').send({ token: tokenFrom(lastMailTo('founder@forge.test').link) }).expect(204);
      expect((await http.get('/v1/me').set(bearer(founder.token))).body.profile.roles).toEqual(['super_admin']);
      await db.query('DELETE FROM users WHERE id = $1', [founder.id]);
      await db.query("INSERT INTO users (email) VALUES ('other@x.test')");
      await db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'super_admin' FROM users WHERE email = 'other@x.test'");
      const again = await register(app, 'founder@forge.test');
      await http.post('/v1/auth/email-verification/confirm').send({ token: tokenFrom(lastMailTo('founder@forge.test').link) }).expect(204);
      expect((await http.get('/v1/me').set(bearer(again.token))).body.profile.roles).toEqual([]);
    });
  });

  describe('onboarding', () => {
    it('completes onboarding, records consent, awards XP exactly once', async () => {
      const u = await register(app);
      const body = onboardingBody();
      const res = await http.post('/v1/me/onboarding').set(bearer(u.token)).send(body).expect(201);
      expect(res.body.profile).toMatchObject({ username: body.username, onboardingCompleted: true, isMinor: false });
      expect((await http.post('/v1/me/onboarding').set(bearer(u.token)).send(body).expect(409)).body.code).toBe('onboarding_already_completed');
      const consents = await db.query('SELECT consent_type, granted FROM user_consents WHERE user_id = $1 ORDER BY consent_type', [u.id]);
      expect(consents.rows).toEqual([
        { consent_type: 'marketing_email', granted: true },
        { consent_type: 'privacy_policy', granted: true },
        { consent_type: 'terms_of_use', granted: true },
      ]);
      const dash = await http.get('/v1/me/dashboard').set(bearer(u.token)).expect(200);
      expect(dash.body.xp).toMatchObject({ total: 50, level: 1, nextLevelXp: 100 });
    });

    it('rejects duplicate usernames with a stable code', async () => {
      const a = await register(app);
      const b = await register(app);
      const body = onboardingBody();
      await http.post('/v1/me/onboarding').set(bearer(a.token)).send(body).expect(201);
      expect((await http.get(`/v1/me/username-availability?username=${body.username}`).set(bearer(b.token))).body.available).toBe(false);
      expect((await http.post('/v1/me/onboarding').set(bearer(b.token)).send(body).expect(409)).body.code).toBe('username_taken');
    });

    it('applies protected-minor defaults and blocks under-13 users', async () => {
      const year = new Date().getUTCFullYear();
      const teen = await register(app);
      const res = await http.post('/v1/me/onboarding').set(bearer(teen.token)).send(onboardingBody({ birthdate: `${year - 15}-01-01` })).expect(201);
      expect(res.body.profile.isMinor).toBe(true);
      const row = await db.one<{ privacy: Record<string, unknown> }>('SELECT privacy FROM profiles WHERE user_id = $1', [teen.id]);
      expect(row?.privacy).toMatchObject({ profileVisibility: 'members', allowMessagesFrom: 'friends' });
      const mk = await db.one<{ granted: boolean }>("SELECT granted FROM user_consents WHERE user_id = $1 AND consent_type = 'marketing_email'", [teen.id]);
      expect(mk?.granted).toBe(false);
      const child = await register(app);
      expect((await http.post('/v1/me/onboarding').set(bearer(child.token)).send(onboardingBody({ birthdate: `${year - 10}-01-01` })).expect(403)).body.code).toBe('age_restricted');
    });

    it('validates input and requires legal acceptance', async () => {
      const u = await register(app);
      const res = await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody({ acceptTerms: false, username: 'x' })).expect(422);
      expect(res.body.details.map((d: { path: string }) => d.path).sort()).toEqual(['acceptTerms', 'username']);
    });

    it('updates preferences', async () => {
      const u = await register(app);
      expect((await http.patch('/v1/me/preferences').set(bearer(u.token)).send({ locale: 'en' }).expect(200)).body.profile.locale).toBe('en');
      await http.patch('/v1/me/preferences').set(bearer(u.token)).send({}).expect(422);
    });
  });

  describe('universe membership', () => {
    it('requires onboarding, then joins idempotently and leaves', async () => {
      const u = await register(app);
      const auth = bearer(u.token);
      expect((await http.post('/v1/universes/supernatural/membership').set(auth).expect(403)).body.code).toBe('onboarding_required');
      await http.post('/v1/me/onboarding').set(auth).send(onboardingBody()).expect(201);
      const before = (await http.get('/v1/universes/supernatural')).body.memberCount;
      expect((await http.post('/v1/universes/supernatural/membership').set(auth).expect(201)).body).toMatchObject({ slug: 'supernatural', xp: 0, level: 1 });
      await http.post('/v1/universes/supernatural/membership').set(auth).expect(201);
      expect((await http.get('/v1/universes/supernatural')).body.memberCount).toBe(before + 1);
      await http.delete('/v1/universes/supernatural/membership').set(auth).expect(204);
      await http.delete('/v1/universes/supernatural/membership').set(auth).expect(404);
      expect((await http.get('/v1/universes/supernatural')).body.memberCount).toBe(before);
    });
  });

  describe('errors', () => {
    it('returns the uniform envelope for unknown routes and bad JSON', async () => {
      expect((await http.get('/v1/does-not-exist').expect(404)).body).toMatchObject({ statusCode: 404, code: 'not_found' });
      const res = await http.post('/v1/auth/login').set('Content-Type', 'application/json').send('{bad json').expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, code: 'bad_request' });
      expect(JSON.stringify(res.body)).not.toMatch(/stack|at |position/);
    });
  });
});
