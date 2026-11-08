import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureTestEnv, onboardingBody, register, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const ALL = ['harry-potter', 'supernatural', 'marvel', 'dc', 'star-wars', 'greys-anatomy', 'station-19', 'bts', 'animes', 'games'];

describe.runIf(enabled)('Book libraries and the Anime / Video Games universes', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const books = async (slug: string) => (await http.get(`/v1/universes/${slug}/archive/books`).expect(200)).body.items as { id: string; slug: string; tags: string[]; subtitle: { 'pt-BR': string } }[];

  async function fan(universe?: string): Promise<TestUser> {
    const u = await register(app);
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody()).expect(201);
    if (universe) await http.post(`/v1/universes/${universe}/membership`).set(bearer(u.token)).expect(201);
    return u;
  }

  beforeAll(async () => {
    configureTestEnv();
    const { createApp } = await import('../src/bootstrap.js');
    app = await createApp({ logger: false });
    await app.init();
    http = request(app.getHttpServer());
  });
  afterAll(async () => {
    await app?.close();
  });

  it('every universe has a book library with real authors and years', async () => {
    for (const slug of ALL) {
      const items = await books(slug);
      expect(items.length, slug).toBeGreaterThanOrEqual(5);
      for (const b of items) {
        expect(b.tags.length, `${slug}/${b.slug}`).toBeGreaterThanOrEqual(1);
        expect(b.subtitle['pt-BR'], `${slug}/${b.slug}`).toMatch(/\d{4}/);
      }
    }
    // Harry Potter's seven books live in the book section (the old generic library is gone).
    const hp = (await http.get('/v1/universes/harry-potter').expect(200)).body;
    expect(hp.features).toContain('books');
    expect(hp.features).not.toContain('library');
    expect((await books('harry-potter')).map((b) => b.slug)).toEqual(expect.arrayContaining(['pedra-filosofal', 'reliquias-da-morte', 'crianca-amaldicoada']));
    await http.get('/v1/universes/harry-potter/archive/library').expect(404);
  });

  it('keeps a personal reading shelf per user', async () => {
    const u = await fan();
    const [first, second, third] = await books('star-wars');
    await http.get('/v1/universes/star-wars/books/shelf').expect(401);
    expect((await http.get('/v1/universes/star-wars/books/shelf').set(bearer(u.token)).expect(200)).body).toEqual({ items: [], counts: { want: 0, reading: 0, read: 0 } });

    await http.put(`/v1/books/${first!.id}/shelf`).set(bearer(u.token)).send({ status: 'read' }).expect(200);
    await http.put(`/v1/books/${second!.id}/shelf`).set(bearer(u.token)).send({ status: 'reading' }).expect(200);
    await http.put(`/v1/books/${third!.id}/shelf`).set(bearer(u.token)).send({ status: 'want' }).expect(200);
    await http.put(`/v1/books/${third!.id}/shelf`).set(bearer(u.token)).send({ status: 'read' }).expect(200);
    let shelf = (await http.get('/v1/universes/star-wars/books/shelf').set(bearer(u.token)).expect(200)).body;
    expect(shelf.counts).toEqual({ want: 0, reading: 1, read: 2 });
    await http.put(`/v1/books/${second!.id}/shelf`).set(bearer(u.token)).send({ status: null }).expect(200);
    shelf = (await http.get('/v1/universes/star-wars/books/shelf').set(bearer(u.token)).expect(200)).body;
    expect(shelf.items.map((i: { entryId: string }) => i.entryId).sort()).toEqual([first!.id, third!.id].sort());

    // Another user's shelf is separate; other universes' shelves are separate too.
    const other = await fan();
    expect((await http.get('/v1/universes/star-wars/books/shelf').set(bearer(other.token)).expect(200)).body.items).toEqual([]);
    expect((await http.get('/v1/universes/marvel/books/shelf').set(bearer(u.token)).expect(200)).body.items).toEqual([]);

    // Only books can go on the shelf; statuses are validated.
    const spell = (await http.get('/v1/universes/harry-potter/archive/spells').expect(200)).body.items[0];
    expect((await http.put(`/v1/books/${spell.id}/shelf`).set(bearer(u.token)).send({ status: 'read' }).expect(404)).body.code).toBe('book_not_found');
    await http.put(`/v1/books/${first!.id}/shelf`).set(bearer(u.token)).send({ status: 'finished' }).expect(422);
  });

  it('Anime and Video Games are complete universes', async () => {
    const list = (await http.get('/v1/universes').expect(200)).body.items.map((u: { slug: string }) => u.slug);
    expect(list).toEqual(expect.arrayContaining(['animes', 'games']));
    for (const [slug, identity] of [['animes', 'anime_style'], ['games', 'gamer_class']] as const) {
      const u = (await http.get(`/v1/universes/${slug}`).expect(200)).body;
      expect(u.identityConfig.type).toBe(identity);
      expect(u.identityConfig.options.length).toBeGreaterThanOrEqual(5);
      expect(u.features).toEqual(expect.arrayContaining(['books', 'quizzes', 'challenges', 'vip_lounge', 'events']));

      const quizzes = (await http.get(`/v1/universes/${slug}/quizzes`).expect(200)).body.items;
      expect(quizzes.map((q: { difficulty: string }) => q.difficulty).sort()).toEqual(['easy', 'hard', 'normal']);
      expect(quizzes.reduce((n: number, q: { questionCount: number }) => n + q.questionCount, 0)).toBe(22);

      const missions = (await http.get(`/v1/universes/${slug}/missions`).expect(200)).body.items;
      expect(missions.length).toBe(12);
      expect(missions.filter((m: { premiumPlan: string | null }) => m.premiumPlan).length).toBe(4);
      const events = (await http.get(`/v1/universes/${slug}/events`).expect(200)).body.items;
      expect(events.find((e: { slug: string }) => e.slug === 'noite-de-quiz')).toMatchObject({ hasQuiz: true });

      // The mini-games work with the new question pool and word bank.
      const u2 = await fan(slug);
      expect((await http.get(`/v1/universes/${slug}/games/daily`).set(bearer(u2.token)).expect(200)).body.questions).toHaveLength(5);
      const hangman = (await http.post(`/v1/universes/${slug}/games/hangman`).set(bearer(u2.token)).expect(201)).body;
      expect(hangman.status).toBe('active');
      await http.put(`/v1/universes/${slug}/identity`).set(bearer(u2.token)).send({ key: u.identityConfig.options[0].key }).expect(200);
    }
    await http.get('/v1/universes/animes/archive/anime_guide').expect(200);
    await http.get('/v1/universes/games/archive/games_guide').expect(200);
  });
});
