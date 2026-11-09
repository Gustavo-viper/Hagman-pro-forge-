import type { INestApplication } from '@nestjs/common';
import type { EmailJobData } from '@fandom/shared';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { captureMail, configureTestEnv, onboardingBody, register, type TestUser } from './helpers.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const T = (pt: string) => ({ 'pt-BR': pt, en: pt });

describe.runIf(enabled)('VIP plan, prize draws and cultural contests', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: import('../src/database/database.service.js').DatabaseService;
  let mail: EmailJobData[];
  let admin: TestUser;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function person(opts: { plan?: 'plus' | 'ultra' | 'vip'; minor?: boolean; verified?: boolean; name?: string } = {}): Promise<TestUser> {
    const u = await register(app);
    const birth = opts.minor ? `${new Date().getUTCFullYear() - 15}-01-01` : '1990-01-01';
    await http.post('/v1/me/onboarding').set(bearer(u.token)).send(onboardingBody({ birthdate: birth, displayName: opts.name ?? 'Pessoa Teste' })).expect(201);
    if (opts.verified !== false) await db.query('UPDATE users SET email_verified = true WHERE id = $1', [u.id]);
    if (opts.plan) await http.post(`/v1/admin/users/${u.id}/grant-plan`).set(bearer(admin.token)).send({ planCode: opts.plan, days: 30, reason: 'teste vip' }).expect(200);
    const { UsersService } = await import('../src/auth/users.service.js');
    await app.get(UsersService).invalidate(u.id);
    return u;
  }
  const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#7c3aed' } }).png().toBuffer();

  beforeAll(async () => {
    configureTestEnv();
    const { createApp } = await import('../src/bootstrap.js');
    const { DatabaseService } = await import('../src/database/database.service.js');
    app = await createApp({ logger: false });
    await app.init();
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

  it('VIP is a fourth plan at R$ 69,90 a month, above Ultra, with its own badge', async () => {
    const plans = (await http.get('/v1/subscription-plans').expect(200)).body.items;
    const vip = plans.find((p: { code: string }) => p.code === 'vip');
    expect(vip.prices).toEqual([{ interval: 'month', currency: 'BRL', amountMinor: 6990 }]);
    expect(vip.benefits['pt-BR'][0]).toBe('Tudo do Fandom Ultra');
    const u = await person({ plan: 'vip', name: 'Membro VIP' });
    expect((await http.get('/v1/me').set(bearer(u.token))).body.subscription.planCode).toBe('vip');
    // Ultra perks included (rank above Ultra): survival mode and stats.
    await http.get('/v1/me/stats').set(bearer(u.token)).expect(200);
    await http.post('/v1/universes/marvel/membership').set(bearer(u.token)).expect(201);
    expect((await http.get('/v1/universes/marvel/games/me').set(bearer(u.token))).body).toMatchObject({ plan: 'vip', survival: { available: true }, limits: { xpBonusPercent: 50 } });
  });

  it('draws only open with an authorization certificate and rules, and give VIPs lucky numbers', async () => {
    const draft = (await http.post('/v1/admin/draws').set(bearer(admin.token)).send({
      title: T('Sorteio de chave Steam'), description: T('Uma chave de jogo aleatório da Steam.'), prize: T('1 chave Steam de jogo aleatório'),
      prizeCount: 1, entriesCloseAt: new Date(Date.now() + 3_600_000).toISOString(),
    }).expect(201)).body;
    expect(draft).toMatchObject({ status: 'draft', certificateNumber: null });
    expect((await http.post(`/v1/admin/draws/${draft.id}/open`).set(bearer(admin.token)).expect(409)).body.code).toBe('authorization_required');
    // The database enforces the lock too.
    await expect(db.query("UPDATE draws SET status = 'open' WHERE id = $1", [draft.id])).rejects.toThrow();
    expect((await http.get('/v1/draws').expect(200)).body.items.map((d: { id: string }) => d.id)).not.toContain(draft.id);

    await http.patch(`/v1/admin/draws/${draft.id}`).set(bearer(admin.token)).send({ certificateNumber: '04.000000/2026', regulationUrl: 'https://fandom.test/regulamento' }).expect(200);
    const opened = (await http.post(`/v1/admin/draws/${draft.id}/open`).set(bearer(admin.token)).expect(200)).body;
    expect(opened.status).toBe('open');
    expect(opened.seedHash).toMatch(/^[0-9a-f]{64}$/);
    await http.patch(`/v1/admin/draws/${draft.id}`).set(bearer(admin.token)).send({ prizeCount: 3 }).expect(409);

    const free = await person();
    const ultra = await person({ plan: 'ultra' });
    const teenVip = await person({ plan: 'vip', minor: true });
    const vip1 = await person({ plan: 'vip', name: 'Vip Um' });
    const vip2 = await person({ plan: 'vip', name: 'Vip Dois' });
    expect((await http.get(`/v1/draws/${draft.id}`).set(bearer(free.token)).expect(200)).body).toMatchObject({ eligible: false, ineligibleReason: 'plan_required', myNumber: null });
    expect((await http.post(`/v1/draws/${draft.id}/entries`).set(bearer(free.token)).expect(403)).body).toMatchObject({ code: 'premium_required', details: { requiredPlan: 'vip' } });
    await http.post(`/v1/draws/${draft.id}/entries`).set(bearer(ultra.token)).expect(403);
    expect((await http.post(`/v1/draws/${draft.id}/entries`).set(bearer(teenVip.token)).expect(403)).body.code).toBe('minor');
    expect((await http.post(`/v1/draws/${draft.id}/entries`).set(bearer(vip1.token)).expect(200)).body).toMatchObject({ myNumber: 1, entryCount: 1 });
    expect((await http.post(`/v1/draws/${draft.id}/entries`).set(bearer(vip2.token)).expect(200)).body.myNumber).toBe(2);
    expect((await http.post(`/v1/draws/${draft.id}/entries`).set(bearer(vip1.token)).expect(200)).body.myNumber).toBe(1);
    const pub = (await http.get(`/v1/draws/${draft.id}`).expect(200)).body;
    expect(pub).toMatchObject({ certificateNumber: '04.000000/2026', phase: 'open', results: null });
    expect(JSON.stringify(pub)).not.toMatch(/seed_sealed|"seed":/);

    // Drawing: only after entries close; verifiable from the published data.
    expect((await http.post(`/v1/admin/draws/${draft.id}/run`).set(bearer(admin.token)).send({ externalValue: '12345' }).expect(409)).body.code).toBe('draw_not_closed');
    await db.query("UPDATE draws SET entries_close_at = now() - interval '1 minute' WHERE id = $1", [draft.id]);
    await http.post(`/v1/draws/${draft.id}/entries`).set(bearer(admin.token)).expect(403);
    mail.length = 0;
    const drawn = (await http.post(`/v1/admin/draws/${draft.id}/run`).set(bearer(admin.token)).send({ externalValue: 'Loteria Federal 5912: 48213' }).expect(200)).body;
    expect(drawn.status).toBe('drawn');
    const results = (await http.get(`/v1/draws/${draft.id}`).expect(200)).body.results;
    const { createHash } = await import('node:crypto');
    expect(createHash('sha256').update(results.seed).digest('hex')).toBe(pub.seedHash);
    const { pickWinners } = await import('../src/prizes/draws.service.js');
    expect(results.winners.map((w: { luckyNumber: number }) => w.luckyNumber)).toEqual(pickWinners(results.seed, results.externalValue, [1, 2], 1));
    const winner = results.winners[0].luckyNumber === 1 ? vip1 : vip2;
    const loser = winner === vip1 ? vip2 : vip1;
    expect(mail.filter((m) => m.template === 'prize_won').map((m) => m.to)).toEqual([winner.email]);

    // Prize delivery: the code is sealed, shown only to the winner, never emailed.
    const prize = (await http.get('/v1/me/prizes').set(bearer(winner.token)).expect(200)).body.items[0];
    expect(prize).toMatchObject({ source: 'draw', luckyNumber: results.winners[0].luckyNumber, code: null });
    expect((await http.get('/v1/me/prizes').set(bearer(loser.token))).body.items).toEqual([]);
    await http.put(`/v1/admin/prizes/${prize.id}/code`).set(bearer(winner.token)).send({ code: 'AAAAA-BBBBB-CCCCC' }).expect(403);
    await http.put(`/v1/admin/prizes/${prize.id}/code`).set(bearer(admin.token)).send({ code: 'AAAAA-BBBBB-CCCCC' }).expect(200);
    expect((await http.get('/v1/me/prizes').set(bearer(winner.token))).body.items[0]).toMatchObject({ code: 'AAAAA-BBBBB-CCCCC' });
    const stored = await db.one<{ code_sealed: string }>('SELECT code_sealed FROM prizes WHERE id = $1', [prize.id]);
    expect(stored!.code_sealed).not.toContain('AAAAA');
    expect(JSON.stringify(mail)).not.toContain('AAAAA');
    expect(mail.map((m) => m.template)).toContain('prize_delivered');
  });

  it('wallpaper contests are free, adult-only, moderated, and the jury picks the winner', async () => {
    const now = Date.now();
    const created = (await http.post('/v1/admin/contests').set(bearer(admin.token)).send({
      slug: `wallpaper-${now.toString(36)}`, title: T('Campeonato de papel de parede'), description: T('Crie um papel de parede de anime.'),
      rules: T('Inscrição gratuita. Arte original. Júri decide considerando o voto popular.'), prize: T('1 mês de Crunchyroll (vale-presente)'),
      universeSlug: 'animes', submissionsOpenAt: new Date(now - 60_000).toISOString(), submissionsCloseAt: new Date(now + 3_600_000).toISOString(),
      votingCloseAt: new Date(now + 7_200_000).toISOString(),
    }).expect(201)).body;
    const slug = created.slug;
    await http.get(`/v1/contests/${slug}`).expect(404); // draft
    await http.post(`/v1/admin/contests/${created.id}/publish`).set(bearer(admin.token)).expect(200);

    const freeArtist = await person({ name: 'Artista Free' }); // no plan needed: free contest
    const teen = await person({ minor: true });
    const unverified = await person({ verified: false });
    const voter = await person({ name: 'Eleitor' });
    const img = await png(1920, 1080);
    const upload = (u: TestUser, file: Buffer, title = 'Céu de Tóquio') =>
      http.post(`/v1/contests/${slug}/entries`).set(bearer(u.token)).field('title', title).field('ownWork', 'true').attach('image', file, 'wallpaper.png');

    expect((await upload(teen, img).expect(403)).body.code).toBe('minor');
    expect((await upload(unverified, img).expect(403)).body.code).toBe('email_not_verified');
    expect((await upload(freeArtist, await png(800, 600)).expect(422)).body.code).toBe('image_too_small');
    expect((await upload(freeArtist, Buffer.from('not an image at all')).expect(422)).body.code).toBe('invalid_image');
    // Metadata (EXIF, GPS) is stripped by re-encoding.
    const withExif = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#e63962' } })
      .jpeg().withExif({ IFD0: { Copyright: 'secret-location' } }).toBuffer();
    const entered = (await upload(freeArtist, withExif).expect(201)).body;
    expect(entered.myEntry).toMatchObject({ title: 'Céu de Tóquio', status: 'pending' });
    expect((await upload(freeArtist, img).expect(409)).body.code).toBe('already_entered');
    const entryId = entered.myEntry.id;
    await http.get(`/v1/contest-entries/${entryId}/image`).expect(404); // not approved yet
    expect((await http.get(`/v1/contests/${slug}`).expect(200)).body.entries).toEqual([]);

    await http.post(`/v1/admin/contest-entries/${entryId}/review`).set(bearer(admin.token)).send({ action: 'approve' }).expect(204);
    const imgRes = await http.get(`/v1/contest-entries/${entryId}/image`).expect(200);
    expect(imgRes.headers['content-type']).toBe('image/webp');
    expect(imgRes.headers['cross-origin-resource-policy']).toBe('cross-origin');
    const meta = await sharp(imgRes.body as Buffer).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 1920, height: 1080 });
    expect(meta.exif).toBeUndefined();

    // Voting only in the voting window; counts hidden while it is open.
    expect((await http.put(`/v1/contests/${slug}/vote`).set(bearer(voter.token)).send({ entryId }).expect(409)).body.code).toBe('voting_closed');
    await db.query("UPDATE contests SET submissions_open_at = now() - interval '2 hours', submissions_close_at = now() - interval '1 minute' WHERE id = $1", [created.id]);
    expect((await http.put(`/v1/contests/${slug}/vote`).set(bearer(freeArtist.token)).send({ entryId }).expect(422)).body.code).toBe('own_entry');
    const voted = (await http.put(`/v1/contests/${slug}/vote`).set(bearer(voter.token)).send({ entryId }).expect(200)).body;
    expect(voted).toMatchObject({ phase: 'voting', myVote: entryId });
    expect(voted.entries[0].voteCount).toBeNull();
    await http.put(`/v1/contests/${slug}/vote`).set(bearer(voter.token)).send({ entryId }).expect(200); // idempotent
    expect((await http.post(`/v1/admin/contests/${created.id}/winner`).set(bearer(admin.token)).send({ entryId }).expect(409)).body.code).toBe('not_judging');

    await db.query("UPDATE contests SET voting_close_at = now() - interval '1 second' WHERE id = $1", [created.id]);
    expect((await http.get(`/v1/contests/${slug}`).expect(200)).body.entries[0]).toMatchObject({ id: entryId, voteCount: 1 });
    mail.length = 0;
    const done = (await http.post(`/v1/admin/contests/${created.id}/winner`).set(bearer(admin.token)).send({ entryId }).expect(200)).body;
    expect(done).toMatchObject({ status: 'finished', phase: 'finished', winner: { entryId, name: 'Artista Free' }, prizeDelivered: false });
    expect(mail.map((m) => [m.template, m.to])).toEqual([['prize_won', freeArtist.email]]);
    await http.put(`/v1/admin/prizes/${done.prizeId}/code`).set(bearer(admin.token)).send({ code: 'CRUNCHY-GIFT-123' }).expect(200);
    expect((await http.get('/v1/me/prizes').set(bearer(freeArtist.token))).body.items[0]).toMatchObject({ source: 'contest', code: 'CRUNCHY-GIFT-123' });
  });
});
