import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { captureMail, configureTestEnv, onboardingBody, register, tokenFrom, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('Universe sections: archive, forum, missions, events, standings', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;
  let mail: import('@fandom/shared').EmailJobData[];
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function fan(universes: string[] = [], verified = true): Promise<TestUser> {
    const u = await register(app);
    if (verified) {
      const link = [...mail].reverse().find((m) => m.to === u.email)!.link;
      await http.post('/v1/auth/email-verification/confirm').send({ token: tokenFrom(link) }).expect(204);
    }
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody()).expect(201);
    for (const s of universes) await http.post(`/v1/universes/${s}/membership`).set(bearer(u.token)).expect(201);
    return u;
  }

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

  it('serves every archive section advertised by every universe', async () => {
    const universes = (await http.get('/v1/universes').expect(200)).body.items;
    const { FEATURE_ENGINE } = await import('@fandom/shared');
    let checked = 0;
    for (const u of universes) {
      for (const f of u.features.filter((x: string) => FEATURE_ENGINE[x] === 'archive')) {
        const items = (await http.get(`/v1/universes/${u.slug}/archive/${f}`).expect(200)).body.items;
        expect(items.length, `${u.slug}/${f}`).toBeGreaterThanOrEqual(2);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(19);
    // A section that this universe does not have is a 404 (no cross-universe leaks).
    expect((await http.get('/v1/universes/bts/archive/spells').expect(404)).body.code).toBe('section_not_found');
  });

  it('runs a forum: members post, others read, reply, report; authors delete', async () => {
    const author = await fan(['supernatural']);
    const other = await fan(['supernatural']);
    const created = await http.post('/v1/universes/supernatural/forum/theories').set(bearer(author.token))
      .send({ title: 'Teoria sobre o Impala', body: '<script>alert(1)</script> O carro tem alma?' }).expect(201);
    expect(created.body).toMatchObject({ title: 'Teoria sobre o Impala', mine: true, replyCount: 0 });
    expect(created.body.body).toContain('<script>'); // stored as plain text; the web renders it escaped

    const list = (await http.get('/v1/universes/supernatural/forum/theories').expect(200)).body;
    expect(list.items[0]).toMatchObject({ id: created.body.id, author: { id: author.id } });

    const replied = (await http.post(`/v1/forum/topics/${created.body.id}/replies`).set(bearer(other.token)).send({ body: 'Com certeza!' }).expect(201)).body;
    expect(replied.replyCount).toBe(1);
    expect(replied.replies[0]).toMatchObject({ body: 'Com certeza!', mine: true });

    await http.post('/v1/reports').set(bearer(other.token)).send({ targetType: 'topic', targetId: created.body.id, reason: 'spam' }).expect(202);
    expect((await http.post('/v1/reports').set(bearer(author.token)).send({ targetType: 'topic', targetId: created.body.id, reason: 'spam' }).expect(422)).body.code).toBe('cannot_report_own');

    await http.delete(`/v1/forum/replies/${replied.replies[0].id}`).set(bearer(author.token)).expect(404);
    await http.delete(`/v1/forum/replies/${replied.replies[0].id}`).set(bearer(other.token)).expect(204);
    await http.delete(`/v1/forum/topics/${created.body.id}`).set(bearer(author.token)).expect(204);
    await http.get(`/v1/forum/topics/${created.body.id}`).expect(404);
  });

  it('enforces forum rules: membership, verified email, valid category, burst limit', async () => {
    const outsider = await fan([]);
    expect((await http.post('/v1/universes/marvel/forum/theories').set(bearer(outsider.token)).send({ title: 'Oi oi', body: 'x' }).expect(403)).body.code).toBe('membership_required');
    const unverified = await fan(['marvel'], false);
    expect((await http.post('/v1/universes/marvel/forum/theories').set(bearer(unverified.token)).send({ title: 'Oi oi', body: 'x' }).expect(403)).body.code).toBe('email_not_verified');
    const member = await fan(['marvel']);
    await http.post('/v1/universes/marvel/forum/fan_art').set(bearer(member.token)).send({ title: 'Oi oi', body: 'x' }).expect(404);
    await http.post('/v1/universes/marvel/forum/theories').set(bearer(member.token)).send({ title: 'x', body: 'x' }).expect(422);
    for (let i = 0; i < 5; i++) await http.post('/v1/universes/marvel/forum/discussions').set(bearer(member.token)).send({ title: `Tópico ${i}`, body: 'conteúdo' }).expect(201);
    expect((await http.post('/v1/universes/marvel/forum/discussions').set(bearer(member.token)).send({ title: 'Mais um', body: 'x' }).expect(429)).body.code).toBe('posting_too_fast');
    const page1 = (await http.get('/v1/universes/marvel/forum/discussions?limit=2').expect(200)).body;
    const page2 = (await http.get(`/v1/universes/marvel/forum/discussions?limit=2&cursor=${page1.nextCursor}`).expect(200)).body;
    expect(page2.items.map((t: { id: string }) => t.id)).not.toContain(page1.items[0].id);
  });

  it('keeps common rooms private to members of the same house', async () => {
    const pick = async (u: TestUser, house: string) => {
      const quiz = (await http.get('/v1/universes/harry-potter/quizzes')).body.items.find((q: { setsIdentity: boolean }) => q.setsIdentity);
      const { rows } = await db.query<{ id: string; options: { key: string; identity: string }[] }>('SELECT id, options FROM questions WHERE quiz_id = $1', [quiz.id]);
      await http.post(`/v1/quizzes/${quiz.id}/attempts`).set(bearer(u.token))
        .send({ answers: Object.fromEntries(rows.map((r) => [r.id, r.options.find((o) => o.identity === house)!.key])) }).expect(201);
    };
    const lion = await fan(['harry-potter']);
    const snake = await fan(['harry-potter']);
    const lion2 = await fan(['harry-potter']);
    expect((await http.get('/v1/universes/harry-potter/forum/common_rooms').set(bearer(lion.token)).expect(403)).body.code).toBe('identity_required');
    await pick(lion, 'gryffindor');
    await pick(snake, 'slytherin');
    await pick(lion2, 'gryffindor');
    const t = (await http.post('/v1/universes/harry-potter/forum/common_rooms').set(bearer(lion.token)).send({ title: 'Senha da torre', body: 'Só para leões' }).expect(201)).body;
    expect(t.identityScope).toBe('gryffindor');
    expect((await http.get('/v1/universes/harry-potter/forum/common_rooms').set(bearer(lion2.token))).body.items.map((x: { id: string }) => x.id)).toContain(t.id);
    expect((await http.get('/v1/universes/harry-potter/forum/common_rooms').set(bearer(snake.token))).body.items.map((x: { id: string }) => x.id)).not.toContain(t.id);
    await http.get(`/v1/forum/topics/${t.id}`).set(bearer(snake.token)).expect(404);
    await http.get('/v1/universes/harry-potter/forum/common_rooms').expect(401);
    await http.post(`/v1/forum/topics/${t.id}/replies`).set(bearer(snake.token)).send({ body: 'intruso' }).expect(404);

    const cup = (await http.get('/v1/universes/harry-potter/standings').expect(200)).body.items;
    expect(cup.map((s: { identity: string }) => s.identity).sort()).toEqual(['gryffindor', 'hufflepuff', 'ravenclaw', 'slytherin']);
    expect(cup.find((s: { identity: string }) => s.identity === 'gryffindor').members).toBeGreaterThanOrEqual(2);
    await http.get('/v1/universes/marvel/standings').expect(404);
  });

  it('completes missions only when the real objective is met, once', async () => {
    const u = await fan(['star-wars']);
    const missions = (await http.get('/v1/universes/star-wars/missions').expect(200)).body.items;
    const oath = missions.find((m: { slug: string }) => m.slug === 'juramento');
    const before = (await http.get('/v1/universes/star-wars/missions/progress').set(bearer(u.token)).expect(200)).body.items;
    expect(before.find((p: { missionId: string }) => p.missionId === oath.id)).toMatchObject({ progress: 0, completed: false });
    expect((await http.post(`/v1/missions/${oath.id}/claim`).set(bearer(u.token)).expect(409)).body.code).toBe('mission_incomplete');

    await http.put('/v1/universes/star-wars/identity').set(bearer(u.token)).send({ key: 'rebel' }).expect(200);
    const claimed = (await http.post(`/v1/missions/${oath.id}/claim`).set(bearer(u.token)).expect(200)).body;
    expect(claimed).toMatchObject({ completed: true, xpAwarded: 15 });
    expect((await http.post(`/v1/missions/${oath.id}/claim`).set(bearer(u.token)).expect(200)).body.xpAwarded).toBe(0);
    const m = (await http.get('/v1/me/dashboard').set(bearer(u.token))).body.memberships.find((x: { slug: string }) => x.slug === 'star-wars');
    expect(m.xp).toBe(15);
    await http.get('/v1/universes/nope/missions').expect(404);
  });

  it('handles events: registration, capacity, premium-only rooms', async () => {
    const u = await fan(['dc']);
    const events = (await http.get('/v1/universes/dc/events').expect(200)).body.items;
    expect(events.length).toBe(3);
    const free = events.find((e: { slug: string }) => e.slug === 'noite-de-quiz');
    const premium = events.find((e: { slug: string }) => e.slug === 'sala-premium');
    const reg = (await http.post(`/v1/events/${free.id}/registration`).set(bearer(u.token)).expect(201)).body;
    expect(reg.participantCount).toBe(free.participantCount + 1);
    await http.post(`/v1/events/${free.id}/registration`).set(bearer(u.token)).expect(201); // idempotent
    expect((await http.get('/v1/universes/dc/events/mine').set(bearer(u.token))).body.items).toEqual([free.id]);
    expect((await http.post(`/v1/events/${premium.id}/registration`).set(bearer(u.token)).expect(403)).body).toMatchObject({ code: 'premium_required', details: { requiredPlan: 'plus' } });

    await db.query(
      `INSERT INTO subscriptions (user_id, plan_code, price_id, status, provider, current_period_end)
       SELECT $1, 'plus', id, 'active', 'manual', now() + interval '10 days' FROM plan_prices WHERE plan_code = 'plus' AND billing_interval = 'month' AND currency = 'BRL'`,
      [u.id],
    );
    await http.post(`/v1/events/${premium.id}/registration`).set(bearer(u.token)).expect(201);
    await http.delete(`/v1/events/${free.id}/registration`).set(bearer(u.token)).expect(204);
    await http.delete(`/v1/events/${free.id}/registration`).set(bearer(u.token)).expect(404);

    // Fill the event to capacity, then a newcomer is refused.
    await http.post(`/v1/events/${free.id}/registration`).set(bearer(u.token)).expect(201);
    await db.query('UPDATE events SET capacity = participant_count WHERE id = $1', [free.id]);
    const late = await fan(['dc']);
    expect((await http.post(`/v1/events/${free.id}/registration`).set(bearer(late.token)).expect(409)).body.code).toBe('event_full');
    await db.query('UPDATE events SET capacity = NULL WHERE id = $1', [free.id]);
  });

  it('lets moderators hide reported content from the admin panel', async () => {
    const author = await fan(['bts']);
    const reporter = await fan(['bts']);
    const mod = await fan([]);
    await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'global_moderator')", [mod.id]);
    const { UsersService } = await import('../src/auth/users.service.js');
    await app.get(UsersService).invalidate(mod.id);

    const t = (await http.post('/v1/universes/bts/forum/fan_projects').set(bearer(author.token)).send({ title: 'Projeto aniversário', body: 'meu telefone é 99999-0000' }).expect(201)).body;
    await http.post('/v1/reports').set(bearer(reporter.token)).send({ targetType: 'topic', targetId: t.id, reason: 'personal_data', details: 'expõe telefone' }).expect(202);
    const open = (await http.get('/v1/admin/reports').set(bearer(mod.token)).expect(200)).body.items;
    const r = open.find((x: { targetId: string }) => x.targetId === t.id);
    expect(r).toMatchObject({ reason: 'personal_data', content: { title: 'Projeto aniversário', universeSlug: 'bts' } });
    await http.post(`/v1/admin/reports/${r.id}/resolve`).set(bearer(reporter.token)).send({ action: 'hide' }).expect(403);
    await http.post(`/v1/admin/reports/${r.id}/resolve`).set(bearer(mod.token)).send({ action: 'hide', note: 'dado pessoal' }).expect(204);
    await http.get(`/v1/forum/topics/${t.id}`).expect(404);
    expect((await http.get('/v1/admin/reports').set(bearer(mod.token))).body.items.map((x: { id: string }) => x.id)).not.toContain(r.id);
    await http.post(`/v1/admin/reports/${r.id}/resolve`).set(bearer(mod.token)).send({ action: 'dismiss' }).expect(409);
  });
});
