import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PLAN_RANK, type Locale, type PlanCode } from '@fandom/shared';
import type { DrawCreateInput, DrawUpdateInput } from '@fandom/schemas';
import type { AdminDraw, DrawSummary, LocalizedText } from '@fandom/types';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { SecretBox } from '../common/secret-box.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DatabaseService, type Queryable } from '../database/database.service.js';
import { MailService } from '../mail/mail.service.js';

interface DrawRow {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  prize: LocalizedText;
  prize_count: number;
  required_plan: 'plus' | 'ultra' | 'vip';
  certificate_number: string | null;
  regulation_url: string | null;
  entries_close_at: Date;
  status: 'draft' | 'open' | 'drawn' | 'cancelled';
  seed_hash: string | null;
  seed_sealed: string | null;
  seed: string | null;
  external_value: string | null;
  drawn_at: Date | null;
  entry_count: number;
}

const DRAW_SELECT = `SELECT d.*, (SELECT count(*)::int FROM draw_entries e WHERE e.draw_id = d.id) AS entry_count FROM draws d`;

/**
 * Verifiable winner selection: the seed was committed (sha256 published) before entries closed
 * and the external value is only known at draw time, so neither side can steer the result.
 * Anyone can recompute it from the published seed, external value and lucky numbers.
 */
export function pickWinners(seed: string, external: string, luckyNumbers: number[], count: number): number[] {
  const remaining = [...luckyNumbers].sort((a, b) => a - b);
  const winners: number[] = [];
  for (let k = 1; k <= count && remaining.length; k++) {
    const h = createHash('sha256').update(`${seed}:${external}:${k}`).digest('hex');
    const idx = Number(BigInt(`0x${h}`) % BigInt(remaining.length));
    winners.push(remaining.splice(idx, 1)[0]!);
  }
  return winners;
}

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class DrawsService {
  private readonly box: SecretBox;

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.box = new SecretBox(env.AUTH_JWT_SECRET);
  }

  private phase(d: DrawRow): AdminDraw['phase'] {
    if (d.status !== 'open') return d.status;
    return d.entries_close_at <= new Date() ? 'closed' : 'open';
  }

  private async userInfo(userId: string): Promise<{ plan: PlanCode; isMinor: boolean }> {
    const r = await this.db.one<{ plan: PlanCode; is_minor: boolean }>(
      'SELECT public.effective_plan(u.id) AS plan, p.is_minor FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1',
      [userId],
    );
    return { plan: r?.plan ?? 'free', isMinor: r?.is_minor ?? true };
  }

  private ineligibility(d: DrawRow, user: AuthenticatedUser | null, info: { plan: PlanCode; isMinor: boolean } | null): string | null {
    if (this.phase(d) !== 'open') return 'closed';
    if (!user || !info) return 'sign_in';
    if (info.isMinor) return 'minor';
    if (!user.emailVerified) return 'email_not_verified';
    if (PLAN_RANK[info.plan] < PLAN_RANK[d.required_plan]) return 'plan_required';
    return null;
  }

  private async winners(drawId: string) {
    const { rows } = await this.db.query<{ id: string; position: number; lucky_number: number; user_id: string; email: string; name: string; delivered: boolean }>(
      `SELECT z.id, z.position, z.lucky_number, z.user_id, u.email, COALESCE(p.display_name, p.username, '—') AS name, z.delivered_at IS NOT NULL AS delivered
         FROM prizes z JOIN users u ON u.id = z.user_id JOIN profiles p ON p.user_id = z.user_id
        WHERE z.source = 'draw' AND z.source_id = $1 ORDER BY z.position`,
      [drawId],
    );
    return rows;
  }

  private async toSummary(d: DrawRow, user: AuthenticatedUser | null): Promise<DrawSummary> {
    const info = user ? await this.userInfo(user.id) : null;
    const mine = user
      ? await this.db.one<{ lucky_number: number }>('SELECT lucky_number FROM draw_entries WHERE draw_id = $1 AND user_id = $2', [d.id, user.id])
      : null;
    const phase = this.phase(d);
    const reason = mine ? null : this.ineligibility(d, user, info);
    const winners = d.status === 'drawn' ? await this.winners(d.id) : [];
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      prize: d.prize,
      prizeCount: d.prize_count,
      requiredPlan: d.required_plan,
      certificateNumber: d.certificate_number,
      regulationUrl: d.regulation_url,
      entriesCloseAt: d.entries_close_at.toISOString(),
      phase: phase === 'draft' ? 'closed' : phase,
      entryCount: d.entry_count,
      seedHash: d.seed_hash,
      myNumber: mine?.lucky_number ?? null,
      eligible: reason === null && !mine,
      ineligibleReason: reason,
      results: d.status === 'drawn' && d.drawn_at
        ? { drawnAt: d.drawn_at.toISOString(), externalValue: d.external_value!, seed: d.seed!, winners: winners.map((w) => ({ position: w.position, luckyNumber: w.lucky_number, name: w.name })) }
        : null,
    };
  }

  // ---------------------------------------------------------------- public

  async list(user: AuthenticatedUser | null): Promise<DrawSummary[]> {
    const { rows } = await this.db.query<DrawRow>(`${DRAW_SELECT} WHERE d.status IN ('open', 'drawn') ORDER BY d.entries_close_at DESC LIMIT 50`);
    return Promise.all(rows.map((d) => this.toSummary(d, user)));
  }

  async detail(user: AuthenticatedUser | null, id: string): Promise<DrawSummary> {
    const d = await this.db.one<DrawRow>(`${DRAW_SELECT} WHERE d.id = $1 AND d.status IN ('open', 'drawn', 'cancelled') AND d.seed_hash IS NOT NULL`, [id]);
    if (!d) throw AppError.notFound('draw_not_found', 'Draw not found');
    return this.toSummary(d, user);
  }

  /** Gives the user their lucky number (once per draw). */
  async enter(user: AuthenticatedUser, id: string): Promise<DrawSummary> {
    await this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`draw:${id}`]);
      const d = (await tx.query<DrawRow>(`${DRAW_SELECT} WHERE d.id = $1`, [id])).rows[0];
      if (!d || d.status === 'draft') throw AppError.notFound('draw_not_found', 'Draw not found');
      const existing = await tx.query('SELECT 1 FROM draw_entries WHERE draw_id = $1 AND user_id = $2', [id, user.id]);
      if (existing.rowCount) return;
      const reason = this.ineligibility(d, user, await this.userInfo(user.id));
      if (reason === 'plan_required') throw new AppError('premium_required', 'Requires the VIP plan', HttpStatus.FORBIDDEN, { requiredPlan: d.required_plan });
      if (reason) throw AppError.forbidden(reason === 'closed' ? 'draw_closed' : reason, 'Not eligible for this draw');
      await tx.query(
        `INSERT INTO draw_entries (draw_id, user_id, lucky_number)
         VALUES ($1, $2, COALESCE((SELECT max(lucky_number) FROM draw_entries WHERE draw_id = $1), 0) + 1)`,
        [id, user.id],
      );
    });
    return this.detail(user, id);
  }

  // ---------------------------------------------------------------- admin

  private async adminView(d: DrawRow): Promise<AdminDraw> {
    const summary = await this.toSummary(d, null);
    const winners = await this.winners(d.id);
    return {
      ...summary,
      status: d.status,
      phase: this.phase(d),
      winners: winners.map((w) => ({ position: w.position, luckyNumber: w.lucky_number, name: w.name, userId: w.user_id, email: w.email, prizeId: w.id, delivered: w.delivered })),
    };
  }

  private async load(q: Queryable, id: string, lock = false): Promise<DrawRow> {
    const d = (await q.query<DrawRow>(`${DRAW_SELECT} WHERE d.id = $1 ${lock ? 'FOR UPDATE OF d' : ''}`, [id])).rows[0];
    if (!d) throw AppError.notFound('draw_not_found', 'Draw not found');
    return d;
  }

  async adminList(): Promise<AdminDraw[]> {
    const { rows } = await this.db.query<DrawRow>(`${DRAW_SELECT} ORDER BY d.created_at DESC LIMIT 100`);
    return Promise.all(rows.map((d) => this.adminView(d)));
  }

  async create(admin: AuthenticatedUser, input: DrawCreateInput): Promise<AdminDraw> {
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO draws (title, description, prize, prize_count, required_plan, entries_close_at, certificate_number, regulation_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [input.title, input.description, input.prize, input.prizeCount, input.requiredPlan, input.entriesCloseAt, input.certificateNumber, input.regulationUrl, admin.id],
    );
    await this.audit.log(this.db.pool, { actorUserId: admin.id, action: 'admin.draw_created', targetType: 'draw', targetId: rows[0]!.id });
    return this.adminView(await this.load(this.db.pool, rows[0]!.id));
  }

  async update(admin: AuthenticatedUser, id: string, input: DrawUpdateInput): Promise<AdminDraw> {
    const d = await this.load(this.db.pool, id);
    if (d.status !== 'draft') throw AppError.conflict('draw_locked', 'Only drafts can be edited');
    const map: Record<string, string> = { title: 'title', description: 'description', prize: 'prize', prizeCount: 'prize_count', entriesCloseAt: 'entries_close_at', certificateNumber: 'certificate_number', regulationUrl: 'regulation_url' };
    const sets: string[] = [];
    const vals: unknown[] = [id];
    for (const [k, v] of Object.entries(input)) {
      vals.push(v);
      sets.push(`${map[k]} = $${vals.length}`);
    }
    await this.db.query(`UPDATE draws SET ${sets.join(', ')} WHERE id = $1`, vals);
    await this.audit.log(this.db.pool, { actorUserId: admin.id, action: 'admin.draw_updated', targetType: 'draw', targetId: id, metadata: { fields: Object.keys(input) } });
    return this.adminView(await this.load(this.db.pool, id));
  }

  /** The authorization lock: no certificate + rules, no draw. */
  async open(admin: AuthenticatedUser, id: string): Promise<AdminDraw> {
    await this.db.transaction(async (tx) => {
      const d = await this.load(tx, id, true);
      if (d.status !== 'draft') throw AppError.conflict('draw_locked', 'Only drafts can be opened');
      if (!d.certificate_number || !d.regulation_url) {
        throw AppError.conflict('authorization_required', 'Register the authorization certificate and the rules before opening the draw');
      }
      if (d.entries_close_at <= new Date()) throw new AppError('validation_failed', 'Entries must close in the future', HttpStatus.UNPROCESSABLE_ENTITY);
      const seed = randomBytes(32).toString('hex');
      await tx.query("UPDATE draws SET status = 'open', seed_hash = $2, seed_sealed = $3, opened_at = now() WHERE id = $1", [id, sha256(seed), this.box.seal(seed)]);
      await this.audit.log(tx, { actorUserId: admin.id, action: 'admin.draw_opened', targetType: 'draw', targetId: id, metadata: { certificate: d.certificate_number } });
    });
    return this.adminView(await this.load(this.db.pool, id));
  }

  async cancel(admin: AuthenticatedUser, id: string): Promise<AdminDraw> {
    await this.db.transaction(async (tx) => {
      const d = await this.load(tx, id, true);
      if (d.status === 'drawn' || d.status === 'cancelled') throw AppError.conflict('draw_locked', 'This draw can no longer be cancelled');
      await tx.query("UPDATE draws SET status = 'cancelled' WHERE id = $1", [id]);
      await this.audit.log(tx, { actorUserId: admin.id, action: 'admin.draw_cancelled', targetType: 'draw', targetId: id });
    });
    return this.adminView(await this.load(this.db.pool, id));
  }

  async run(admin: AuthenticatedUser, id: string, externalValue: string): Promise<AdminDraw> {
    const notified = await this.db.transaction(async (tx) => {
      const d = await this.load(tx, id, true);
      if (d.status !== 'open') throw AppError.conflict('draw_locked', 'This draw is not open');
      if (d.entries_close_at > new Date()) throw AppError.conflict('draw_not_closed', 'Entries are still open');
      const { rows } = await tx.query<{ lucky_number: number; user_id: string }>('SELECT lucky_number, user_id FROM draw_entries WHERE draw_id = $1', [id]);
      if (!rows.length) throw AppError.conflict('no_entries', 'Nobody entered this draw');
      const seed = this.box.open(d.seed_sealed!);
      const winners = pickWinners(seed, externalValue, rows.map((r) => r.lucky_number), d.prize_count);
      const byNumber = new Map(rows.map((r) => [r.lucky_number, r.user_id]));
      for (const [i, n] of winners.entries()) {
        await tx.query(
          `INSERT INTO prizes (user_id, source, source_id, position, lucky_number, description) VALUES ($1, 'draw', $2, $3, $4, $5)`,
          [byNumber.get(n), id, i + 1, n, d.prize],
        );
      }
      await tx.query("UPDATE draws SET status = 'drawn', seed = $2, external_value = $3, drawn_at = now() WHERE id = $1", [id, seed, externalValue]);
      await this.audit.log(tx, { actorUserId: admin.id, action: 'admin.draw_run', targetType: 'draw', targetId: id, metadata: { externalValue, winners } });
      return { title: d.title, prize: d.prize, users: winners.map((n) => byNumber.get(n)!) };
    });
    for (const userId of notified.users) await this.notify(userId, 'prize_won', notified.title, notified.prize);
    return this.adminView(await this.load(this.db.pool, id));
  }

  /** Sends a prize email in the user's language (failures never break the admin action). */
  async notify(userId: string, template: 'prize_won' | 'prize_delivered', title: LocalizedText, prize: LocalizedText): Promise<void> {
    const u = await this.db.one<{ email: string; locale: Locale }>('SELECT u.email, p.locale FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1', [userId]);
    if (!u) return;
    await this.mail
      .send({ to: u.email, template, locale: u.locale, link: `${this.env.APP_PUBLIC_URL.replace(/\/+$/, '')}/premios`, details: { title: title[u.locale] ?? title['pt-BR'], plan: prize[u.locale] ?? prize['pt-BR'] } })
      .catch(() => undefined);
  }
}
