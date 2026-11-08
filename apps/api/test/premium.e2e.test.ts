import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { captureMail, configureTestEnv, onboardingBody, register, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('Fandom Premium perks', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;
  let admin: TestUser;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function fan(universe: string, name: string, plan?: 'plus' | 'ultra'): Promise<TestUser> {
    const u = await register(app);
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody({ displayName: name })).expect(201);
    await http.post(`/v1/universes/${universe}/membership`).set(bearer(u.token)).expect(201);
    await db.query('UPDATE users SET email_verified = true WHERE id = $1', [u.id]);
    if (plan) await http.post(`/v1/admin/users/${u.id}/grant-plan`).set(bearer(admin.token)).send({ planCode: plan, days: 30, reason: 'teste de vantagens' }).expect(200);
    const { UsersService } = await import('../src/auth/users.service.js');
    await app.get(UsersService).invalidate(u.id);
    return u;
  }
  const keyOf = async (questionId: string, right = true) => {
    const q = await db.one<{ correct_key: string; options: { key: string }[] }>('SELECT correct_key, options FROM questions WHERE id = $1', [questionId]);
    return right ? q!.correct_key : q!.options.find((o) => o.key !== q!.correct_key)!.key;
  };
  const perfectAnswers = async (quizId: string) => {
    const { rows } = await db.query<{ id: string; correct_key: string }>('SELECT id, correct_key FROM questions WHERE quiz_id = $1', [quizId]);
    return Object.fromEntries(rows.map((r) => [r.id, r.correct_key]));
  };
  const universeXp = async (u: TestUser, slug: string) =>
    (await http.get('/v1/me/dashboard').set(bearer(u.token))).body.memberships.find((m: { slug: string }) => m.slug === slug).xp as number;
  const quizId = async (slug: string, quiz: string) =>
    (await http.get(`/v1/universes/${slug}/quizzes`).expect(200)).body.items.find((q: { slug: string }) => q.slug === quiz).id as string;

  beforeAll(async () => {
    configureTestEnv();
    const { createApp } = await import('../src/bootstrap.js');
    const { DatabaseService } = await import('../src/database/database.service.js');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DatabaseService);
    http = request(app.getHttpServer());
    await captureMail(app);
    admin = await register(app);
    await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')", [admin.id]);
    const { UsersService } = await import('../src/auth/users.service.js');
    await app.get(UsersService).invalidate(admin.id);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('effective_plan() in SQL matches the entitlement rules', async () => {
    const { entitledPlan } = await import('../src/subscriptions/entitlements.service.js');
    const u = await fan('marvel', 'Plano SQL', 'plus');
    const sql = async () => (await db.one<{ p: string }>('SELECT public.effective_plan($1) AS p', [u.id]))!.p;
    const row = async () => (await db.one<Parameters<typeof entitledPlan>[0] & object>(
      `SELECT s.plan_code, s.status, p.billing_interval, s.current_period_end, s.grace_until, s.cancel_at_period_end
         FROM subscriptions s JOIN plan_prices p ON p.id = s.price_id WHERE s.user_id = $1`, [u.id]))!;
    for (const change of [
      "status = 'active'",
      "status = 'past_due', grace_until = now() + interval '1 day'",
      "status = 'past_due', grace_until = now() - interval '1 day'",
      "status = 'cancelled', current_period_end = now() + interval '3 days'",
      "status = 'cancelled', current_period_end = now() - interval '1 day'",
      "status = 'active', current_period_end = now() - interval '1 hour'",
    ]) {
      await db.query(`UPDATE subscriptions SET ${change} WHERE user_id = $1`, [u.id]);
      expect(await sql(), change).toBe(entitledPlan(await row(), new Date()));
    }
    expect((await db.one<{ p: string }>('SELECT public.effective_plan(gen_random_uuid()) AS p'))!.p).toBe('free');
  });

  it('subscribers get +20% (Plus) / +50% (Ultra) XP as a separate, idempotent ledger entry', async () => {
    const id = await quizId('marvel', 'herois-e-artefatos');
    const answers = await perfectAnswers(id);
    const free = await fan('marvel', 'Fã Free');
    const plus = await fan('marvel', 'Fã Plus', 'plus');
    const ultra = await fan('marvel', 'Fã Ultra', 'ultra');
    const results = [];
    for (const u of [free, plus, ultra]) {
      const before = await universeXp(u, 'marvel');
      const r = (await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(u.token)).send({ answers }).expect(201)).body;
      results.push({ base: r.xpAwarded, bonus: r.xpBonus, gained: (await universeXp(u, 'marvel')) - before });
    }
    expect(results).toEqual([{ base: 60, bonus: 0, gained: 60 }, { base: 60, bonus: 12, gained: 72 }, { base: 60, bonus: 30, gained: 90 }]);
    // Replaying a finished quiz pays nothing (neither base nor bonus).
    expect((await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(ultra.token)).send({ answers }).expect(201)).body).toMatchObject({ xpAwarded: 0, xpBonus: 0 });
    const ledger = await db.query<{ source_ref: string; amount: number }>("SELECT source_ref, amount FROM xp_transactions WHERE user_id = $1 AND source_ref LIKE 'premium:%'", [ultra.id]);
    expect(ledger.rows).toEqual([{ source_ref: 'premium:ultra', amount: 30 }]);
  });

  it('plans raise the daily game limits and show them in the overview', async () => {
    const free = await fan('dc', 'Limite Free');
    const ultra = await fan('dc', 'Limite Ultra', 'ultra');
    const o1 = (await http.get('/v1/universes/dc/games/me').set(bearer(free.token)).expect(200)).body;
    const o2 = (await http.get('/v1/universes/dc/games/me').set(bearer(ultra.token)).expect(200)).body;
    expect(o1).toMatchObject({ plan: 'free', limits: { speedDailyXp: 60, hangmanRewardedWins: 5, survivalDailyXp: 0, xpBonusPercent: 0 }, survival: { available: false } });
    expect(o2).toMatchObject({ plan: 'ultra', limits: { speedDailyXp: 200, hangmanRewardedWins: 20, survivalDailyXp: 160, xpBonusPercent: 50 }, survival: { available: true } });

    // Speed round through the whole pool (22 right answers = 66 XP before the cap).
    for (const [u, expected] of [[free, { base: 60, bonus: 0 }], [ultra, { base: 66, bonus: 33 }]] as const) {
      let r = (await http.post('/v1/universes/dc/games/speed').set(bearer(u.token)).expect(201)).body;
      while (r.status === 'active') {
        r = (await http.post(`/v1/games/speed/${r.id}/answers`).set(bearer(u.token)).send({ questionId: r.question.id, key: await keyOf(r.question.id) }).expect(200)).body;
      }
      expect(r.score).toBe(22);
      expect({ base: r.xpAwarded, bonus: r.xpBonus }).toEqual(expected);
    }
  });

  it('survival mode is for subscribers: ends on the first mistake or a timed-out question', async () => {
    const free = await fan('star-wars', 'Sem Plus');
    const plus = await fan('star-wars', 'Sobrevivente Plus', 'plus');
    expect((await http.post('/v1/universes/star-wars/games/survival').set(bearer(free.token)).expect(403)).body).toMatchObject({ code: 'premium_required', details: { requiredPlan: 'plus' } });

    let run = (await http.post('/v1/universes/star-wars/games/survival').set(bearer(plus.token)).expect(201)).body;
    expect(run).toMatchObject({ status: 'active', score: 0, questionSeconds: 20 });
    expect(JSON.stringify(run.question)).not.toMatch(/correct/);
    for (let i = 0; i < 10; i++) {
      run = (await http.post(`/v1/games/survival/${run.id}/answers`).set(bearer(plus.token)).send({ questionId: run.question.id, key: await keyOf(run.question.id) }).expect(200)).body;
    }
    expect(run).toMatchObject({ status: 'active', score: 10 });
    const wrongQ = run.question.id;
    run = (await http.post(`/v1/games/survival/${run.id}/answers`).set(bearer(plus.token)).send({ questionId: wrongQ, key: await keyOf(wrongQ, false) }).expect(200)).body;
    expect(run).toMatchObject({ status: 'finished', score: 10, xpAwarded: 20, xpBonus: 4, question: null, last: { correct: false, timedOut: false } });
    expect((await http.post(`/v1/games/survival/${run.id}/answers`).set(bearer(plus.token)).send({ questionId: wrongQ, key: 'a' }).expect(409)).body.code).toBe('game_finished');

    // A late answer counts as a miss even if it is right.
    let late = (await http.post('/v1/universes/star-wars/games/survival').set(bearer(plus.token)).expect(201)).body;
    await db.query("UPDATE game_sessions SET state = jsonb_set(state, '{questionDeadline}', to_jsonb((now() - interval '10 seconds')::text)) WHERE id = $1", [late.id]);
    late = (await http.post(`/v1/games/survival/${late.id}/answers`).set(bearer(plus.token)).send({ questionId: late.question.id, key: await keyOf(late.question.id) }).expect(200)).body;
    expect(late).toMatchObject({ status: 'finished', score: 0, last: { correct: false, timedOut: true } });

    const board = (await http.get('/v1/universes/star-wars/games/leaderboard?game=survival').expect(200)).body.items;
    expect(board.find((e: { displayName: string }) => e.displayName === 'Sobrevivente Plus')).toMatchObject({ score: 10, plan: 'plus' });

    // Its Plus mission is claimable by Plus only.
    const mission = (await http.get('/v1/universes/star-wars/missions').expect(200)).body.items.find((m: { slug: string }) => m.slug === 'sobrevivente');
    expect(mission).toMatchObject({ premiumPlan: 'plus', objectiveType: 'survival_score', objectiveCount: 10 });
    expect((await http.post(`/v1/missions/${mission.id}/claim`).set(bearer(free.token)).expect(403)).body.code).toBe('premium_required');
    expect((await http.post(`/v1/missions/${mission.id}/claim`).set(bearer(plus.token)).expect(200)).body).toMatchObject({ completed: true, xpAwarded: 100, xpBonus: 20 });
    const ultraMission = (await http.get('/v1/universes/star-wars/missions').expect(200)).body.items.find((m: { slug: string }) => m.slug === 'lenda-ultra');
    expect((await http.post(`/v1/missions/${ultraMission.id}/claim`).set(bearer(plus.token)).expect(403)).body.details).toEqual({ requiredPlan: 'ultra' });
  });

  it('VIP lounge: subscribers only, and subscriber badges appear next to names', async () => {
    const free = await fan('bts', 'ARMY Free');
    const plus = await fan('bts', 'ARMY Plus', 'plus');
    const ultra = await fan('bts', 'ARMY Ultra', 'ultra');
    await http.get('/v1/universes/bts/forum/vip_lounge').expect(401);
    expect((await http.get('/v1/universes/bts/forum/vip_lounge').set(bearer(free.token)).expect(403)).body.code).toBe('premium_required');
    await http.post('/v1/universes/bts/forum/vip_lounge').set(bearer(free.token)).send({ title: 'Quero entrar', body: 'Posso entrar na sala?' }).expect(403);
    const topic = (await http.post('/v1/universes/bts/forum/vip_lounge').set(bearer(plus.token)).send({ title: 'Bem-vindos à Sala VIP', body: 'Espaço dos assinantes.' }).expect(201)).body;
    expect(topic.author.plan).toBe('plus');
    await http.post(`/v1/forum/topics/${topic.id}/replies`).set(bearer(ultra.token)).send({ body: 'Chegando com o Ultra!' }).expect(201);
    const detail = (await http.get(`/v1/forum/topics/${topic.id}`).set(bearer(ultra.token)).expect(200)).body;
    expect(detail.replies[0].author.plan).toBe('ultra');
    await http.get(`/v1/forum/topics/${topic.id}`).set(bearer(free.token)).expect(403);

    // Badges in public forums and rankings too; Free users carry none.
    const open = (await http.post('/v1/universes/bts/forum/discussions').set(bearer(free.token)).send({ title: 'Tópico aberto', body: 'Todo mundo pode ver.' }).expect(201)).body;
    expect(open.author.plan).toBeNull();
    const ranking = (await http.get('/v1/universes/marvel/ranking').expect(200)).body.items;
    expect(ranking.find((r: { displayName: string }) => r.displayName === 'Fã Ultra')).toMatchObject({ plan: 'ultra' });
    expect(ranking.find((r: { displayName: string }) => r.displayName === 'Fã Free')).toMatchObject({ plan: null });
  });

  it('plan benefits describe exactly the delivered perks', async () => {
    const plans = (await http.get('/v1/subscription-plans').expect(200)).body.items;
    const plus = plans.find((p: { code: string }) => p.code === 'plus');
    expect(plus.benefits['pt-BR']).toEqual(expect.arrayContaining(['+20% de XP em quizzes, jogos e missões', 'Modo Sobrevivência em todos os universos']));
  });
});
