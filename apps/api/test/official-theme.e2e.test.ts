import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureTestEnv, register, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('official universe theme songs (YouTube embeds)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;
  let editor: TestUser;
  let fan: TestUser;
  let original: unknown;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    configureTestEnv();
    const { createApp } = await import('../src/bootstrap.js');
    const { DatabaseService } = await import('../src/database/database.service.js');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DatabaseService);
    http = request(app.getHttpServer());
    editor = await register(app);
    fan = await register(app);
    await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'editor')", [editor.id]);
    const { UsersService } = await import('../src/auth/users.service.js');
    await app.get(UsersService).invalidate(editor.id);
    original = (await db.one<{ t: unknown }>("SELECT official_theme AS t FROM universe_settings s JOIN universes u ON u.id = s.universe_id WHERE u.slug = 'dc'"))!.t;
  });
  afterAll(async () => {
    await db?.query("UPDATE universe_settings s SET official_theme = $1 FROM universes u WHERE u.id = s.universe_id AND u.slug = 'dc'", [original === null ? null : JSON.stringify(original)]);
    await app?.close();
  });

  it('every seeded universe has an official theme; nothing is hosted, only a YouTube id', async () => {
    const items = (await http.get('/v1/universes').expect(200)).body.items as { slug: string; officialTheme: { youtubeId: string; title: string } | null }[];
    expect(items).toHaveLength(10);
    for (const u of items) expect(u.officialTheme?.youtubeId, u.slug).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(items.find((u) => u.slug === 'bts')!.officialTheme).toEqual({ youtubeId: 'gdZLi9oWNZg', title: 'Dynamite', artist: 'BTS' });
  });

  it('staff change or remove it; fans cannot; only YouTube links are accepted; seeds keep the staff choice', async () => {
    const body = { theme: { url: 'https://youtu.be/Sgtom9QTzKI?si=abc', title: 'Come Together', artist: 'Gary Clark Jr.' } };
    await http.put('/v1/universes/dc/official-theme').set(bearer(fan.token)).send(body).expect(403);
    await http.put('/v1/universes/dc/official-theme').send(body).expect(401);
    await http.put('/v1/universes/dc/official-theme').set(bearer(editor.token)).send({ theme: { url: 'https://vimeo.com/123', title: 'x' } }).expect(422);
    const set = await http.put('/v1/universes/dc/official-theme').set(bearer(editor.token)).send(body).expect(200);
    expect(set.body.officialTheme).toEqual({ youtubeId: 'Sgtom9QTzKI', title: 'Come Together', artist: 'Gary Clark Jr.' });
    expect((await http.get('/v1/universes').expect(200)).body.items.find((u: { slug: string }) => u.slug === 'dc').officialTheme.title).toBe('Come Together');

    const removed = await http.put('/v1/universes/dc/official-theme').set(bearer(editor.token)).send({ theme: null }).expect(200);
    expect(removed.body.officialTheme).toBeNull();
    // Re-running the seed (every deploy) does not bring back a theme the staff removed.
    const { readFile } = await import('node:fs/promises');
    await db.query(await readFile(new URL('../../../database/seeds/0014_official_themes.sql', import.meta.url), 'utf8'));
    expect((await http.get('/v1/universes/dc').expect(200)).body.officialTheme).toBeNull();
    await http.put('/v1/universes/nope/official-theme').set(bearer(editor.token)).send(body).expect(404);
  });
});
