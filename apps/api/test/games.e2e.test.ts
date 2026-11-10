import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureTestEnv, onboardingBody, register, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('Universe mini-games: daily challenge, speed round, hangman', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function fan(universe?: string, name = 'Jogador'): Promise<TestUser> {
    const u = await register(app);
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody({ displayName: name })).expect(201);
    if (universe) await http.post(`/v1/universes/${universe}/membership`).set(bearer(u.token)).expect(201);
    return u;
  }
  const keyOf = async (questionId: string, right = true) => {
    const q = await db.one<{ correct_key: string; options: { key: string }[] }>('SELECT correct_key, options FROM questions WHERE id = $1', [questionId]);
    return right ? q!.correct_key : q!.options.find((o) => o.key !== q!.correct_key)!.key;
  };
  const universeXp = async (u: TestUser, slug: string) =>
    (await http.get('/v1/me/dashboard').set(bearer(u.token))).body.memberships.find((m: { slug: string }) => m.slug === slug).xp as number;
  const hiddenWord = async (gameId: string) =>
    (await db.one<{ word: string }>("SELECT state->>'word' AS word FROM game_sessions WHERE id = $1", [gameId]))!.word;
  const lettersOf = (word: string) => [...new Set([...word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()].filter((c) => /[A-Z]/.test(c)))];

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

  it('daily challenge: same 5 questions for everyone, one play per day, graded on the server', async () => {
    await http.get('/v1/universes/marvel/games/daily').expect(401);
    const a = await fan('marvel', 'Diária A');
    const b = await fan('marvel', 'Diária B');
    const outsider = await fan(undefined, 'Visitante');

    const dayA = (await http.get('/v1/universes/marvel/games/daily').set(bearer(a.token)).expect(200)).body;
    const dayB = (await http.get('/v1/universes/marvel/games/daily').set(bearer(b.token)).expect(200)).body;
    expect(dayA.questions).toHaveLength(5);
    expect(dayA.questions.map((q: { id: string }) => q.id)).toEqual(dayB.questions.map((q: { id: string }) => q.id));
    expect(dayA.result).toBeNull();
    expect(JSON.stringify(dayA.questions)).not.toMatch(/correct|explanation/);
    expect(dayA.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const perfect = Object.fromEntries(await Promise.all(dayA.questions.map(async (q: { id: string }) => [q.id, await keyOf(q.id)])));
    await http.post('/v1/universes/marvel/games/daily').set(bearer(outsider.token)).send({ answers: perfect }).expect(403);
    const partial = Object.fromEntries(Object.entries(perfect).slice(0, 3));
    expect((await http.post('/v1/universes/marvel/games/daily').set(bearer(a.token)).send({ answers: partial }).expect(422)).body.code).toBe('incomplete_answers');

    const xpBefore = await universeXp(a, 'marvel');
    const played = (await http.post('/v1/universes/marvel/games/daily').set(bearer(a.token)).send({ answers: perfect }).expect(200)).body;
    expect(played.result).toMatchObject({ score: 5, total: 5, xpAwarded: 5 * 8 + 10 });
    expect(played.result.review.every((r: { correct: boolean }) => r.correct)).toBe(true);
    expect(played.streak).toBe(1);
    expect(await universeXp(a, 'marvel')).toBe(xpBefore + 50);
    expect((await http.post('/v1/universes/marvel/games/daily').set(bearer(a.token)).send({ answers: perfect }).expect(409)).body.code).toBe('daily_already_played');
    expect(await universeXp(a, 'marvel')).toBe(xpBefore + 50);

    // B gets two wrong → lower on today's board.
    const ids = Object.keys(perfect);
    const mixed = Object.fromEntries(await Promise.all(ids.map(async (id, i) => [id, await keyOf(id, i >= 2)])));
    expect((await http.post('/v1/universes/marvel/games/daily').set(bearer(b.token)).send({ answers: mixed }).expect(200)).body.result).toMatchObject({ score: 3, xpAwarded: 24 });

    const board = (await http.get('/v1/universes/marvel/games/leaderboard?game=daily').expect(200)).body.items;
    const ia = board.findIndex((e: { displayName: string }) => e.displayName === 'Diária A');
    const ib = board.findIndex((e: { displayName: string }) => e.displayName === 'Diária B');
    expect(ia).toBeGreaterThanOrEqual(0);
    expect(ia).toBeLessThan(ib);
    const overview = (await http.get('/v1/universes/marvel/games/me').set(bearer(a.token)).expect(200)).body;
    expect(overview.daily).toMatchObject({ playedToday: true, score: 5, total: 5, streak: 1 });

    // Streak counts consecutive days (yesterday + today = 2).
    await db.query(
      `INSERT INTO game_sessions (user_id, universe_id, game, status, score, total, day, finished_at)
       SELECT $1, id, 'daily', 'finished', 1, 5, ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1), now() - interval '1 day' FROM universes WHERE slug = 'marvel'`,
      [a.id],
    );
    expect((await http.get('/v1/universes/marvel/games/me').set(bearer(a.token))).body.daily.streak).toBe(2);
  });

  it('speed round: one question at a time, server deadline, XP capped per day', async () => {
    const u = await fan('star-wars', 'Velocista');
    await http.post('/v1/universes/star-wars/games/speed').expect(401);
    const outsider = await fan();
    await http.post('/v1/universes/star-wars/games/speed').set(bearer(outsider.token)).expect(403);

    let round = (await http.post('/v1/universes/star-wars/games/speed').set(bearer(u.token)).expect(201)).body;
    expect(round).toMatchObject({ status: 'active', score: 0, answered: 0, durationSeconds: 60 });
    expect(JSON.stringify(round.question)).not.toMatch(/correct/);
    expect((await http.post(`/v1/games/speed/${round.id}/answers`).set(bearer(u.token)).send({ questionId: '00000000-0000-4000-8000-000000000000', key: 'a' }).expect(409)).body.code).toBe('wrong_question');
    const other = await fan('star-wars');
    await http.post(`/v1/games/speed/${round.id}/answers`).set(bearer(other.token)).send({ questionId: round.question.id, key: 'a' }).expect(404);

    // 10 right answers, then 1 wrong.
    for (let i = 0; i < 11; i++) {
      const qid = round.question.id;
      round = (await http.post(`/v1/games/speed/${round.id}/answers`).set(bearer(u.token)).send({ questionId: qid, key: await keyOf(qid, i < 10) }).expect(200)).body;
      expect(round.last).toMatchObject({ questionId: qid, correct: i < 10 });
    }
    expect(round).toMatchObject({ status: 'active', score: 10, answered: 11 });
    const xpBefore = await universeXp(u, 'star-wars');
    round = (await http.post(`/v1/games/speed/${round.id}/finish`).set(bearer(u.token)).expect(200)).body;
    expect(round).toMatchObject({ status: 'finished', score: 10, xpAwarded: 30, question: null });
    expect(await universeXp(u, 'star-wars')).toBe(xpBefore + 30);
    expect((await http.post(`/v1/games/speed/${round.id}/answers`).set(bearer(u.token)).send({ questionId: round.id, key: 'a' }).expect(409)).body.code).toBe('game_finished');
    // Finishing twice pays nothing more.
    expect((await http.post(`/v1/games/speed/${round.id}/finish`).set(bearer(u.token)).expect(200)).body.xpAwarded).toBe(30);

    // Past the deadline the server stops grading and closes the round.
    let late = (await http.post('/v1/universes/star-wars/games/speed').set(bearer(u.token)).expect(201)).body;
    await db.query("UPDATE game_sessions SET state = jsonb_set(state, '{deadline}', to_jsonb((now() - interval '10 seconds')::text)) WHERE id = $1", [late.id]);
    late = (await http.post(`/v1/games/speed/${late.id}/answers`).set(bearer(u.token)).send({ questionId: late.question.id, key: await keyOf(late.question.id) }).expect(200)).body;
    expect(late).toMatchObject({ status: 'finished', score: 0, xpAwarded: 0 });
    expect(late.last).toBeUndefined();

    // Daily cap: 60 XP from speed rounds. 30 already earned → a 12-point round pays 30.
    let big = (await http.post('/v1/universes/star-wars/games/speed').set(bearer(u.token)).expect(201)).body;
    for (let i = 0; i < 12; i++) {
      big = (await http.post(`/v1/games/speed/${big.id}/answers`).set(bearer(u.token)).send({ questionId: big.question.id, key: await keyOf(big.question.id) }).expect(200)).body;
    }
    // Starting a new round closes the previous one with its score.
    const next = (await http.post('/v1/universes/star-wars/games/speed').set(bearer(u.token)).expect(201)).body;
    const closed = await db.one<{ status: string; score: number; xp_awarded: number }>('SELECT status, score, xp_awarded FROM game_sessions WHERE id = $1', [big.id]);
    expect(closed).toMatchObject({ status: 'finished', score: 12, xp_awarded: 30 });
    expect((await http.post(`/v1/games/speed/${next.id}/finish`).set(bearer(u.token)).expect(200)).body.xpAwarded).toBe(0);
    const overview = (await http.get('/v1/universes/star-wars/games/me').set(bearer(u.token)).expect(200)).body;
    expect(overview.speed).toMatchObject({ best: 12, weekBest: 12, xpLeftToday: 0 });
    const board = (await http.get('/v1/universes/star-wars/games/leaderboard?game=speed').expect(200)).body.items;
    expect(board.find((e: { displayName: string }) => e.displayName === 'Velocista')).toMatchObject({ score: 12 });

    // Speed mission: 8 right answers in one round.
    const mission = (await http.get('/v1/universes/star-wars/missions').expect(200)).body.items.find((m: { slug: string }) => m.slug === 'contra-o-relogio');
    expect(mission).toMatchObject({ objectiveType: 'speed_score', objectiveCount: 8 });
    expect((await http.post(`/v1/missions/${mission.id}/claim`).set(bearer(u.token)).expect(200)).body).toMatchObject({ completed: true, xpAwarded: 45 });
  });

  it('hangman: hidden word, accent-insensitive letters, 6 lives, rewarded wins capped per day', async () => {
    const u = await fan('supernatural', 'Enforcador');
    const game = (await http.post('/v1/universes/supernatural/games/hangman').set(bearer(u.token)).expect(201)).body;
    expect(game).toMatchObject({ status: 'active', word: null, livesLeft: 6, maxLives: 6, guessed: [], wrong: [] });
    expect(game.mask.some((c: string | null) => c === null)).toBe(true);
    expect(JSON.stringify(game)).not.toContain(await hiddenWord(game.id));
    const other = await fan('supernatural');
    await http.get(`/v1/games/hangman/${game.id}`).set(bearer(other.token)).expect(404);
    expect((await http.post(`/v1/games/hangman/${game.id}/guesses`).set(bearer(u.token)).send({ letter: 'ab' }).expect(422)).body.code).toBe('validation_failed');

    // Win: guess every letter of the word (lowercase input is accepted).
    const word = await hiddenWord(game.id);
    let state = game;
    for (const l of lettersOf(word)) {
      state = (await http.post(`/v1/games/hangman/${game.id}/guesses`).set(bearer(u.token)).send({ letter: l.toLowerCase() }).expect(200)).body;
    }
    expect(state).toMatchObject({ status: 'won', word, livesLeft: 6, xpAwarded: 15 });
    expect((await http.post(`/v1/games/hangman/${game.id}/guesses`).set(bearer(u.token)).send({ letter: 'Q' }).expect(409)).body.code).toBe('game_finished');

    // Lose: six letters that are not in the word; repeating a letter costs nothing.
    const lose = (await http.post('/v1/universes/supernatural/games/hangman').set(bearer(u.token)).expect(201)).body;
    const lw = await hiddenWord(lose.id);
    const absent = [...'QZXJKWVYFBPGHMUDCLTNS'].filter((l) => !lettersOf(lw).includes(l)).slice(0, 6);
    expect(absent).toHaveLength(6);
    let s = (await http.post(`/v1/games/hangman/${lose.id}/guesses`).set(bearer(u.token)).send({ letter: absent[0] }).expect(200)).body;
    s = (await http.post(`/v1/games/hangman/${lose.id}/guesses`).set(bearer(u.token)).send({ letter: absent[0] }).expect(200)).body;
    expect(s.livesLeft).toBe(5);
    for (const l of absent.slice(1)) s = (await http.post(`/v1/games/hangman/${lose.id}/guesses`).set(bearer(u.token)).send({ letter: l }).expect(200)).body;
    expect(s).toMatchObject({ status: 'lost', livesLeft: 0, word: lw, xpAwarded: 0 });

    // Starting a new game abandons the active one.
    const abandoned = (await http.post('/v1/universes/supernatural/games/hangman').set(bearer(u.token)).expect(201)).body;
    const fresh = (await http.post('/v1/universes/supernatural/games/hangman').set(bearer(u.token)).expect(201)).body;
    expect((await http.get(`/v1/games/hangman/${abandoned.id}`).set(bearer(u.token)).expect(200)).body.status).toBe('lost');
    expect((await http.get('/v1/universes/supernatural/games/me').set(bearer(u.token))).body.hangman).toMatchObject({ activeId: fresh.id, wins: 1, rewardedWinsLeft: 4 });

    // Five rewarded wins per day; the sixth still counts as a win but pays no XP.
    const xp: number[] = [];
    let gid = fresh.id;
    for (let i = 0; i < 5; i++) {
      const w = await hiddenWord(gid);
      let r = null;
      for (const l of lettersOf(w)) r = (await http.post(`/v1/games/hangman/${gid}/guesses`).set(bearer(u.token)).send({ letter: l }).expect(200)).body;
      xp.push(r.xpAwarded);
      if (i < 4) gid = (await http.post('/v1/universes/supernatural/games/hangman').set(bearer(u.token)).expect(201)).body.id;
    }
    expect(xp).toEqual([15, 15, 15, 15, 0]);
    expect((await http.get('/v1/universes/supernatural/games/me').set(bearer(u.token))).body.hangman).toMatchObject({ wins: 6, rewardedWinsLeft: 0, activeId: null });
    const board = (await http.get('/v1/universes/supernatural/games/leaderboard?game=hangman').expect(200)).body.items;
    expect(board.find((e: { displayName: string }) => e.displayName === 'Enforcador')).toMatchObject({ score: 6 });

    const mission = (await http.get('/v1/universes/supernatural/missions').expect(200)).body.items.find((m: { slug: string }) => m.slug === 'mestre-da-forca');
    expect((await http.post(`/v1/missions/${mission.id}/claim`).set(bearer(u.token)).expect(200)).body).toMatchObject({ completed: true, xpAwarded: 35 });
    await http.get('/v1/universes/supernatural/games/leaderboard?game=nope').expect(422);
  });

  it('hangman: scene clues are revealed one at a time and never leak the word', async () => {
    const u = await fan('harry-potter');
    const game = (await http.post('/v1/universes/harry-potter/games/hangman').set(bearer(u.token)).expect(201)).body;
    expect(game.clues).toEqual([]);
    expect(game.cluesTotal).toBeGreaterThanOrEqual(2);
    const other = await fan('harry-potter');
    await http.post(`/v1/games/hangman/${game.id}/clues`).set(bearer(other.token)).expect(404);
    let s = game;
    for (let i = 1; i <= game.cluesTotal; i++) {
      s = (await http.post(`/v1/games/hangman/${game.id}/clues`).set(bearer(u.token)).expect(200)).body;
      expect(s.clues).toHaveLength(i);
      expect(s.clues[i - 1]).toMatchObject({ 'pt-BR': expect.any(String), en: expect.any(String) });
    }
    // Asking past the last clue is a no-op; lives are never spent on clues.
    s = (await http.post(`/v1/games/hangman/${game.id}/clues`).set(bearer(u.token)).expect(200)).body;
    expect(s).toMatchObject({ clues: expect.any(Array), livesLeft: 6, status: 'active', word: null });
    expect(s.clues).toHaveLength(game.cluesTotal);
    expect((await http.get(`/v1/games/hangman/${game.id}`).set(bearer(u.token)).expect(200)).body.clues).toHaveLength(game.cluesTotal);
  });

  it('every universe has a hangman bank, a daily pool and game missions', async () => {
    for (const slug of ['harry-potter', 'supernatural', 'marvel', 'dc', 'star-wars', 'greys-anatomy', 'station-19', 'bts', 'animes', 'games']) {
      const words = await db.one<{ n: number }>('SELECT count(*)::int AS n FROM game_words w JOIN universes u ON u.id = w.universe_id WHERE u.slug = $1', [slug]);
      expect(words!.n, slug).toBeGreaterThanOrEqual(15);
      const noClues = await db.one<{ n: number }>("SELECT count(*)::int AS n FROM game_words w JOIN universes u ON u.id = w.universe_id WHERE u.slug = $1 AND jsonb_array_length(w.clues) < 2", [slug]);
      expect(noClues!.n, slug).toBe(0);
      const quizzes = (await http.get(`/v1/universes/${slug}/quizzes`).expect(200)).body.items;
      expect(quizzes.filter((q: { kind: string }) => q.kind === 'trivia').length, slug).toBeGreaterThanOrEqual(3);
      const missions = (await http.get(`/v1/universes/${slug}/missions`).expect(200)).body.items.map((m: { objectiveType: string }) => m.objectiveType);
      expect(missions, slug).toEqual(expect.arrayContaining(['daily_complete', 'daily_perfect', 'speed_score', 'hangman_win']));
      // No repeated question inside a universe's pool (the games draw from all its quizzes).
      const dup = await db.query<{ prompt: string }>(
        `SELECT x.prompt->>'pt-BR' AS prompt FROM questions x JOIN quizzes q ON q.id = x.quiz_id JOIN universes u ON u.id = q.universe_id
          WHERE u.slug = $1 AND q.kind = 'trivia' GROUP BY 1 HAVING count(*) > 1`, [slug]);
      expect(dup.rows, slug).toEqual([]);
    }
  });
});
