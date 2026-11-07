import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureTestEnv, onboardingBody, register, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('Universe quizzes, identity and ranking', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function fan(universe?: string, name = 'Fã Quiz'): Promise<TestUser> {
    const u = await register(app);
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody({ displayName: name })).expect(201);
    if (universe) await http.post(`/v1/universes/${universe}/membership`).set(bearer(u.token)).expect(201);
    return u;
  }
  async function quizId(universe: string, slug: string): Promise<string> {
    const list = (await http.get(`/v1/universes/${universe}/quizzes`).expect(200)).body.items;
    return list.find((q: { slug: string }) => q.slug === slug).id;
  }
  async function correctAnswers(id: string, wrong = 0): Promise<Record<string, string>> {
    const { rows } = await db.query<{ id: string; correct_key: string; options: { key: string }[] }>(
      'SELECT id, correct_key, options FROM questions WHERE quiz_id = $1 ORDER BY position', [id]);
    return Object.fromEntries(rows.map((r, i) => [r.id, i < wrong ? r.options.find((o) => o.key !== r.correct_key)!.key : r.correct_key]));
  }

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

  it('lists quizzes for every universe and never exposes answers', async () => {
    for (const slug of ['harry-potter', 'supernatural', 'marvel', 'dc', 'star-wars', 'greys-anatomy', 'station-19', 'bts']) {
      const items = (await http.get(`/v1/universes/${slug}/quizzes`).expect(200)).body.items;
      expect(items.length, slug).toBeGreaterThanOrEqual(1);
      expect(items.every((q: { questionCount: number }) => q.questionCount === 6)).toBe(true);
    }
    const id = await quizId('star-wars', 'academia-jedi');
    const detail = (await http.get(`/v1/quizzes/${id}`).expect(200)).body;
    expect(detail.questions).toHaveLength(6);
    expect(JSON.stringify(detail)).not.toMatch(/correct|explanation|identity"/);
    await http.get('/v1/universes/nope/quizzes').expect(404);
  });

  it('grades on the server and pays XP only up to the quiz reward (no farming)', async () => {
    const u = await fan('star-wars');
    const id = await quizId('star-wars', 'academia-jedi');

    const first = (await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(u.token)).send({ answers: await correctAnswers(id, 3) }).expect(201)).body;
    expect(first).toMatchObject({ score: 3, total: 6, xpAwarded: 30, xpRemaining: 30 });
    expect(first.review.filter((r: { correct: boolean }) => r.correct)).toHaveLength(3);

    const perfect = (await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(u.token)).send({ answers: await correctAnswers(id) }).expect(201)).body;
    expect(perfect).toMatchObject({ score: 6, xpAwarded: 30, xpRemaining: 0 });
    const again = (await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(u.token)).send({ answers: await correctAnswers(id) }).expect(201)).body;
    expect(again.xpAwarded).toBe(0);

    const dash = (await http.get('/v1/me/dashboard').set(bearer(u.token))).body;
    expect(dash.xp.total).toBe(50 + 60); // onboarding + quiz
    expect(dash.memberships.find((m: { slug: string }) => m.slug === 'star-wars').xp).toBe(60);
    const progress = (await http.get('/v1/universes/star-wars/quiz-progress').set(bearer(u.token))).body.items;
    expect(progress).toEqual([{ quizId: id, attempts: 3, bestScore: 6, total: 6, xpEarned: 60 }]);
  });

  it('requires membership and complete, valid answers', async () => {
    const outsider = await fan();
    const id = await quizId('dc', 'lendas-de-dc');
    expect((await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(outsider.token)).send({ answers: await correctAnswers(id) }).expect(403)).body.code).toBe('membership_required');
    await http.post(`/v1/quizzes/${id}/attempts`).send({ answers: {} }).expect(401);
    const member = await fan('dc');
    const answers = await correctAnswers(id);
    const partial = Object.fromEntries(Object.entries(answers).slice(0, 5));
    expect((await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(member.token)).send({ answers: partial }).expect(422)).body.code).toBe('incomplete_answers');
    const bogus = { ...answers, [Object.keys(answers)[0]!]: 'z' };
    await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(member.token)).send({ answers: bogus }).expect(422);
  });

  it('sorts Harry Potter fans into a house through the personality quiz', async () => {
    const u = await fan('harry-potter');
    const id = await quizId('harry-potter', 'qual-e-a-sua-casa');
    const { rows } = await db.query<{ id: string; options: { key: string; identity: string }[] }>('SELECT id, options FROM questions WHERE quiz_id = $1 ORDER BY position', [id]);
    const answers = Object.fromEntries(rows.map((r) => [r.id, r.options.find((o) => o.identity === 'ravenclaw')!.key]));
    const res = (await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(u.token)).send({ answers }).expect(201)).body;
    expect(res).toMatchObject({ resultIdentity: 'ravenclaw', xpAwarded: 30 });
    const m = (await http.get('/v1/me/dashboard').set(bearer(u.token))).body.memberships.find((x: { slug: string }) => x.slug === 'harry-potter');
    expect(m.identity).toEqual({ type: 'house', key: 'ravenclaw', source: 'quiz' });
    expect((await http.put('/v1/universes/harry-potter/identity').set(bearer(u.token)).send({ key: 'gryffindor' }).expect(409)).body.code).toBe('identity_requires_quiz');
  });

  it('lets members choose their identity in other universes', async () => {
    const u = await fan('star-wars');
    const m = (await http.put('/v1/universes/star-wars/identity').set(bearer(u.token)).send({ key: 'jedi' }).expect(200)).body;
    expect(m.identity).toEqual({ type: 'faction', key: 'jedi', source: 'choice' });
    expect((await http.put('/v1/universes/star-wars/identity').set(bearer(u.token)).send({ key: 'wizard' }).expect(422)).body.code).toBe('invalid_identity');
    const outsider = await fan();
    expect((await http.put('/v1/universes/bts/identity').set(bearer(outsider.token)).send({ key: 'dancer' }).expect(403)).body.code).toBe('membership_required');
  });

  it('ranks members by universe XP (all time and by period)', async () => {
    const top = await fan('marvel', 'Primeira Marvel');
    const id = await quizId('marvel', 'herois-e-artefatos');
    await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(top.token)).send({ answers: await correctAnswers(id) }).expect(201);
    await http.put('/v1/universes/marvel/identity').set(bearer(top.token)).send({ key: 'hero' }).expect(200);
    const second = await fan('marvel', 'Segunda Marvel');
    await http.post(`/v1/quizzes/${id}/attempts`).set(bearer(second.token)).send({ answers: await correctAnswers(id, 3) }).expect(201);

    for (const period of ['all', 'week', 'month']) {
      const r = (await http.get(`/v1/universes/marvel/ranking?period=${period}`).expect(200)).body.items;
      const mine = r.filter((e: { userId: string }) => [top.id, second.id].includes(e.userId));
      expect(mine.map((e: { displayName: string }) => e.displayName), period).toEqual(['Primeira Marvel', 'Segunda Marvel']);
      expect(mine[0].xp).toBe(60);
    }
    const all = (await http.get('/v1/universes/marvel/ranking').expect(200)).body.items;
    expect(all.find((e: { userId: string }) => e.userId === top.id)).toMatchObject({ identity: 'hero', level: 1 });
    await http.get('/v1/universes/marvel/ranking?period=year').expect(422);
  });
});

describe('personalityResult', () => {
  it('picks the most frequent identity, ties broken by the latest answer', async () => {
    const { personalityResult } = await import('../src/quizzes/quizzes.service.js');
    expect(personalityResult(['a', 'b', 'a'])).toBe('a');
    expect(personalityResult(['a', 'b', 'b', 'a'])).toBe('a');
    expect(personalityResult(['a', 'b'])).toBe('b');
    expect(personalityResult([])).toBeNull();
  });
});
