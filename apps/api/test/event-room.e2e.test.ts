import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { captureMail, configureTestEnv, onboardingBody, register, tokenFrom, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('Event rooms, live chat and admin events', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let base: string;
  let db: import('../src/database/database.service.js').DatabaseService;
  let mail: import('@fandom/shared').EmailJobData[];
  let admin: TestUser;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function fan(universe = 'marvel'): Promise<TestUser> {
    const u = await register(app);
    const link = [...mail].reverse().find((m) => m.to === u.email)!.link;
    await http.post('/v1/auth/email-verification/confirm').send({ token: tokenFrom(link) }).expect(204);
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody()).expect(201);
    await http.post(`/v1/universes/${universe}/membership`).set(bearer(u.token)).expect(201);
    return u;
  }
  const iso = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60_000).toISOString();
  async function quizId(universe: string) {
    return (await http.get(`/v1/universes/${universe}/quizzes`)).body.items.find((q: { kind: string }) => q.kind === 'trivia').id as string;
  }
  async function createEvent(over: Record<string, unknown> = {}) {
    return (await http.post('/v1/admin/events').set(bearer(admin.token)).send({
      universeSlug: 'marvel', kind: 'tournament',
      title: { 'pt-BR': 'Torneio ao vivo', en: 'Live tournament' }, description: { 'pt-BR': 'Quiz ao vivo', en: 'Live quiz' },
      startsAt: iso(10), endsAt: iso(70), capacity: null, premiumPlan: null,
      externalUrl: 'https://www.youtube.com/watch?v=fandom', quizId: await quizId('marvel'), ...over,
    }).expect(201)).body;
  }

  beforeAll(async () => {
    configureTestEnv();
    const { createApp } = await import('../src/bootstrap.js');
    const { DatabaseService } = await import('../src/database/database.service.js');
    app = await createApp({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    db = app.get(DatabaseService);
    http = request(app.getHttpServer());
    mail = await captureMail(app);
    admin = await register(app);
    await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')", [admin.id]);
    const { UsersService } = await import('../src/auth/users.service.js');
    await app.get(UsersService).invalidate(admin.id);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('lets staff create, edit and validate events', async () => {
    const e = await createEvent();
    expect(e).toMatchObject({ universeSlug: 'marvel', hasQuiz: true, hasExternalLink: true, status: 'published' });
    const fanUser = await fan();
    await http.post('/v1/admin/events').set(bearer(fanUser.token)).send({}).expect(403);
    const bad = await http.post('/v1/admin/events').set(bearer(admin.token)).send({
      universeSlug: 'marvel', kind: 'community', title: { 'pt-BR': 'x', en: 'x' }, description: { 'pt-BR': 'x', en: 'x' },
      startsAt: iso(60), endsAt: iso(30), externalUrl: 'http://insecure.example',
    }).expect(422);
    expect(bad.body.details.map((d: { path: string }) => d.path).sort()).toEqual(['endsAt', 'externalUrl']);
    await http.post('/v1/admin/events').set(bearer(admin.token)).send({
      universeSlug: 'dc', kind: 'community', title: { 'pt-BR': 'Errado', en: 'Wrong' }, description: { 'pt-BR': 'x', en: 'x' },
      startsAt: iso(10), endsAt: iso(20), quizId: await quizId('marvel'),
    }).expect(422);
    const edited = (await http.patch(`/v1/admin/events/${e.id}`).set(bearer(admin.token)).send({ capacity: 50, externalUrl: null }).expect(200)).body;
    expect(edited).toMatchObject({ capacity: 50, hasExternalLink: false });
    expect((await http.get('/v1/universes/marvel/events')).body.items.map((x: { id: string }) => x.id)).toContain(e.id);
  });

  it('opens the room only to registered fans, with link, chat and live quiz scoreboard', async () => {
    const e = await createEvent();
    const a = await fan();
    const b = await fan();
    const outsider = await fan();
    await http.post(`/v1/events/${e.id}/registration`).set(bearer(a.token)).expect(201);
    await http.post(`/v1/events/${e.id}/registration`).set(bearer(b.token)).expect(201);
    expect((await http.get(`/v1/events/${e.id}/room`).set(bearer(outsider.token)).expect(403)).body.code).toBe('registration_required');

    const room = (await http.get(`/v1/events/${e.id}/room`).set(bearer(a.token)).expect(200)).body;
    expect(room).toMatchObject({ open: true, externalUrl: 'https://www.youtube.com/watch?v=fandom', canModerate: false, quiz: { questionCount: 6 } });

    // Live stream: b listens, a posts, b receives it in real time.
    const controller = new AbortController();
    const res = await fetch(`${base}/v1/events/${e.id}/room/stream`, { headers: bearer(b.token), signal: controller.signal });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const events: Record<string, unknown>[] = [];
    const pump = (async () => {
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (const part of buf.split('\n\n').slice(0, -1)) {
          const line = part.split('\n').find((l) => l.startsWith('data:'));
          if (line) events.push(JSON.parse(line.slice(5)));
        }
        buf = buf.split('\n\n').pop()!;
      }
    })().catch(() => undefined);
    const waitFor = async (pred: (e: Record<string, unknown>) => boolean) => {
      for (let i = 0; i < 50; i++) {
        if (events.some(pred)) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`event not received: ${JSON.stringify(events)}`);
    };
    await waitFor((x) => x.type === 'ready');

    const msg = (await http.post(`/v1/events/${e.id}/room/messages`).set(bearer(a.token)).send({ body: 'Boa noite, Vingadores!' }).expect(201)).body;
    await waitFor((x) => x.type === 'message' && (x.message as { body: string }).body === 'Boa noite, Vingadores!');
    expect((await http.post(`/v1/events/${e.id}/room/messages`).set(bearer(a.token)).send({ body: 'spam' }).expect(429)).body.code).toBe('posting_too_fast');
    await http.post(`/v1/events/${e.id}/room/messages`).set(bearer(outsider.token)).send({ body: 'oi' }).expect(403);

    // Live quiz: a plays → scoreboard-changed event and the room scoreboard lists a.
    const qid = await quizId('marvel');
    const { rows } = await db.query<{ id: string; correct_key: string }>('SELECT id, correct_key FROM questions WHERE quiz_id = $1', [qid]);
    await http.post(`/v1/quizzes/${qid}/attempts`).set(bearer(a.token)).send({ answers: Object.fromEntries(rows.map((r) => [r.id, r.correct_key])) }).expect(201);
    await waitFor((x) => x.type === 'leaderboard-changed');
    const after = (await http.get(`/v1/events/${e.id}/room`).set(bearer(b.token))).body;
    expect(after.leaderboard[0]).toMatchObject({ userId: a.id, score: 6, total: 6, rank: 1 });
    expect(after.messages.map((m: { body: string }) => m.body)).toContain('Boa noite, Vingadores!');

    // Author deletes own message; others cannot; removal is broadcast.
    await http.delete(`/v1/events/${e.id}/room/messages/${msg.id}`).set(bearer(b.token)).expect(404);
    await http.delete(`/v1/events/${e.id}/room/messages/${msg.id}`).set(bearer(a.token)).expect(204);
    await waitFor((x) => x.type === 'removed' && x.id === msg.id);
    controller.abort();
    await pump;
  });

  it('keeps the room closed until 30 minutes before the start', async () => {
    const e = await createEvent({ startsAt: iso(24 * 60), endsAt: iso(25 * 60) });
    const a = await fan();
    await http.post(`/v1/events/${e.id}/registration`).set(bearer(a.token)).expect(201);
    const room = (await http.get(`/v1/events/${e.id}/room`).set(bearer(a.token)).expect(200)).body;
    expect(room).toMatchObject({ open: false, externalUrl: null, messages: [] });
    expect((await http.post(`/v1/events/${e.id}/room/messages`).set(bearer(a.token)).send({ body: 'cedo' }).expect(409)).body.code).toBe('room_closed');
    expect((await http.get(`/v1/events/${e.id}/room/stream`).set(bearer(a.token)).expect(409)).body.code).toBe('room_closed');
  });

  it('cancels an event and emails the participants', async () => {
    const e = await createEvent({ startsAt: iso(60 * 48), endsAt: iso(60 * 49) });
    const a = await fan();
    await http.post(`/v1/events/${e.id}/registration`).set(bearer(a.token)).expect(201);
    const cancelled = (await http.post(`/v1/admin/events/${e.id}/cancel`).set(bearer(admin.token)).expect(200)).body;
    expect(cancelled.status).toBe('cancelled');
    expect([...mail].reverse().find((m) => m.to === a.email)).toMatchObject({ template: 'event_cancelled', details: { title: 'Torneio ao vivo' } });
    await http.post(`/v1/admin/events/${e.id}/cancel`).set(bearer(admin.token)).expect(409);
    const late = await fan();
    expect((await http.post(`/v1/events/${e.id}/registration`).set(bearer(late.token)).expect(404)).body.code).toBe('event_not_found');
    expect((await http.get('/v1/universes/marvel/events')).body.items.find((x: { id: string }) => x.id === e.id).status).toBe('cancelled');
  });
});
