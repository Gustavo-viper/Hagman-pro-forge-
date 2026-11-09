import { HttpStatus, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { ContestCreateInput, ContestEntryFields, ContestUpdateInput } from '@fandom/schemas';
import type { AdminContest, ContestDetail, ContestEntryView, ContestSummary, LocalizedText } from '@fandom/types';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { planBadge } from '../common/plan-badge.js';
import { DatabaseService, type Queryable } from '../database/database.service.js';
import { DrawsService } from './draws.service.js';

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const MIN_SIDE = 720;
const MAX_INPUT_PIXELS = 50_000_000;

interface ContestRow {
  id: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  rules: LocalizedText;
  prize: LocalizedText;
  universe_slug: string | null;
  submissions_open_at: Date;
  submissions_close_at: Date;
  voting_close_at: Date;
  status: 'draft' | 'published' | 'finished' | 'cancelled';
  winner_entry_id: string | null;
  entry_count: number;
}

const CONTEST_SELECT = `
  SELECT c.*, u.slug AS universe_slug,
         (SELECT count(*)::int FROM contest_entries e WHERE e.contest_id = c.id AND e.status = 'approved') AS entry_count
    FROM contests c LEFT JOIN universes u ON u.id = c.universe_id`;

export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

/** Re-encodes the upload: validates it is a real image, strips metadata (EXIF/GPS), bounds size. */
export async function processWallpaper(input: Buffer): Promise<{ image: Buffer; thumb: Buffer; width: number; height: number }> {
  // Loaded lazily: a native-module problem only affects uploads, never the API boot.
  const sharp = (await import('sharp')).default;
  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new AppError('invalid_image', 'Unsupported or corrupted image', HttpStatus.UNPROCESSABLE_ENTITY);
  }
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) throw new AppError('invalid_image', 'Use JPG, PNG or WebP', HttpStatus.UNPROCESSABLE_ENTITY);
  const w = meta.autoOrient?.width ?? meta.width ?? 0;
  const h = meta.autoOrient?.height ?? meta.height ?? 0;
  if (Math.max(w, h) < MIN_SIDE * 1.5 || Math.min(w, h) < MIN_SIDE) {
    throw new AppError('image_too_small', `Wallpapers need at least ${MIN_SIDE * 1.5}x${MIN_SIDE} pixels`, HttpStatus.UNPROCESSABLE_ENTITY);
  }
  const base = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  const image = await base().resize({ width: 3840, height: 3840, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  const thumb = await base().resize({ width: 640, height: 640, fit: 'inside' }).webp({ quality: 74 }).toBuffer();
  return { image: image.data, thumb, width: image.info.width, height: image.info.height };
}

@Injectable()
export class ContestsService implements OnApplicationBootstrap {
  private readonly logger = new Logger('ContestsService');

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly draws: DrawsService,
  ) {}

  /** Non-fatal probe: reports in the boot log whether wallpaper processing (sharp) works on this host. */
  onApplicationBootstrap(): void {
    void import('sharp')
      .then(({ default: sharp }) => sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).webp().toBuffer())
      .then(() => this.logger.log('wallpaper image processing ready'))
      .catch((e: unknown) => this.logger.error(`wallpaper image processing unavailable: ${String(e)}`));
  }

  private phase(c: ContestRow, now = new Date()): ContestSummary['phase'] {
    if (c.status === 'cancelled') return 'cancelled';
    if (c.status === 'finished') return 'finished';
    if (now < c.submissions_open_at) return 'upcoming';
    if (now < c.submissions_close_at) return 'submissions';
    if (now < c.voting_close_at) return 'voting';
    return 'judging';
  }

  private async winner(c: ContestRow): Promise<ContestSummary['winner']> {
    if (!c.winner_entry_id) return null;
    const w = await this.db.one<{ id: string; title: string; name: string }>(
      `SELECT e.id, e.title, COALESCE(p.display_name, p.username, '—') AS name FROM contest_entries e JOIN profiles p ON p.user_id = e.user_id WHERE e.id = $1`,
      [c.winner_entry_id],
    );
    return w ? { entryId: w.id, title: w.title, name: w.name } : null;
  }

  private async summary(c: ContestRow): Promise<ContestSummary> {
    return {
      id: c.id, slug: c.slug, title: c.title, description: c.description, rules: c.rules, prize: c.prize, universeSlug: c.universe_slug,
      submissionsOpenAt: c.submissions_open_at.toISOString(), submissionsCloseAt: c.submissions_close_at.toISOString(), votingCloseAt: c.voting_close_at.toISOString(),
      phase: this.phase(c), entryCount: c.entry_count, winner: await this.winner(c),
    };
  }

  private async load(q: Queryable, where: string, param: string, lock = false): Promise<ContestRow> {
    const c = (await q.query<ContestRow>(`${CONTEST_SELECT} WHERE ${where} ${lock ? 'FOR UPDATE OF c' : ''}`, [param])).rows[0];
    if (!c) throw AppError.notFound('contest_not_found', 'Contest not found');
    return c;
  }

  private async publicContest(slug: string): Promise<ContestRow> {
    const c = await this.load(this.db.pool, 'c.slug = $1', slug);
    if (c.status === 'draft') throw AppError.notFound('contest_not_found', 'Contest not found');
    return c;
  }

  // ---------------------------------------------------------------- public

  async list(): Promise<ContestSummary[]> {
    const { rows } = await this.db.query<ContestRow>(`${CONTEST_SELECT} WHERE c.status <> 'draft' ORDER BY c.submissions_open_at DESC LIMIT 50`);
    return Promise.all(rows.map((c) => this.summary(c)));
  }

  private async submitBlock(c: ContestRow, user: AuthenticatedUser | null): Promise<string | null> {
    if (this.phase(c) !== 'submissions') return 'closed';
    if (!user) return 'sign_in';
    const p = await this.db.one<{ is_minor: boolean; done: boolean }>(
      'SELECT is_minor, onboarding_completed_at IS NOT NULL AS done FROM profiles WHERE user_id = $1',
      [user.id],
    );
    if (!p?.done) return 'onboarding_required';
    if (p.is_minor) return 'minor';
    if (!user.emailVerified) return 'email_not_verified';
    const active = await this.db.one("SELECT 1 FROM contest_entries WHERE contest_id = $1 AND user_id = $2 AND status IN ('pending', 'approved')", [c.id, user.id]);
    return active ? 'already_entered' : null;
  }

  async detail(user: AuthenticatedUser | null, slug: string): Promise<ContestDetail> {
    const c = await this.publicContest(slug);
    const phase = this.phase(c);
    const showVotes = phase === 'judging' || phase === 'finished';
    const { rows } = await this.db.query<{ id: string; title: string; description: string | null; user_id: string; username: string | null; display_name: string | null; plan: string; width: number; height: number; vote_count: number }>(
      `SELECT e.id, e.title, e.description, e.user_id, p.username, p.display_name, public.effective_plan(e.user_id) AS plan, e.width, e.height, e.vote_count
         FROM contest_entries e JOIN profiles p ON p.user_id = e.user_id
        WHERE e.contest_id = $1 AND e.status = 'approved'
        ORDER BY ${showVotes ? 'e.vote_count DESC,' : ''} e.created_at`,
      [c.id],
    );
    const entries: ContestEntryView[] = rows.map((r) => ({
      id: r.id, title: r.title, description: r.description,
      author: { id: r.user_id, username: r.username, displayName: r.display_name, plan: planBadge(r.plan) },
      width: r.width, height: r.height,
      imagePath: `/v1/contest-entries/${r.id}/image`, thumbPath: `/v1/contest-entries/${r.id}/image?size=thumb`,
      voteCount: showVotes ? r.vote_count : null,
      mine: user?.id === r.user_id,
    }));
    let myEntry: ContestDetail['myEntry'] = null;
    let myVote: string | null = null;
    if (user) {
      const e = await this.db.one<{ id: string; title: string; status: 'pending' | 'approved' | 'rejected'; thumb: Buffer }>(
        `SELECT id, title, status, thumb FROM contest_entries WHERE contest_id = $1 AND user_id = $2 AND status IN ('pending', 'approved', 'rejected')
          ORDER BY created_at DESC LIMIT 1`,
        [c.id, user.id],
      );
      if (e) myEntry = { id: e.id, title: e.title, status: e.status, thumbDataUrl: `data:image/webp;base64,${e.thumb.toString('base64')}` };
      myVote = (await this.db.one<{ entry_id: string }>('SELECT entry_id FROM contest_votes WHERE contest_id = $1 AND user_id = $2', [c.id, user.id]))?.entry_id ?? null;
    }
    const block = await this.submitBlock(c, user);
    return { ...(await this.summary(c)), entries, myEntry, myVote, canSubmit: block === null, submitBlockReason: block };
  }

  async submit(user: AuthenticatedUser, slug: string, fields: ContestEntryFields, file: UploadedImage | undefined): Promise<ContestDetail> {
    const c = await this.publicContest(slug);
    const block = await this.submitBlock(c, user);
    if (block === 'closed') throw AppError.conflict('contest_closed', 'Submissions are closed');
    if (block === 'already_entered') throw AppError.conflict('already_entered', 'You already have an entry in this contest');
    if (block) throw AppError.forbidden(block, 'You cannot enter this contest');
    if (!file?.buffer?.length) throw new AppError('image_required', 'Attach your wallpaper', HttpStatus.UNPROCESSABLE_ENTITY);
    if (file.size > MAX_UPLOAD_BYTES) throw new AppError('image_too_large', 'Images up to 6 MB', HttpStatus.PAYLOAD_TOO_LARGE);
    const img = await processWallpaper(file.buffer);
    try {
      await this.db.query(
        `INSERT INTO contest_entries (contest_id, user_id, title, description, image, thumb, width, height) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [c.id, user.id, fields.title, fields.description || null, img.image, img.thumb, img.width, img.height],
      );
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw AppError.conflict('already_entered', 'You already have an entry in this contest');
      throw e;
    }
    return this.detail(user, slug);
  }

  async withdraw(user: AuthenticatedUser, slug: string): Promise<ContestDetail> {
    const c = await this.publicContest(slug);
    if (this.phase(c) !== 'submissions') throw AppError.conflict('contest_closed', 'Entries can only be withdrawn while submissions are open');
    await this.db.query("UPDATE contest_entries SET status = 'withdrawn' WHERE contest_id = $1 AND user_id = $2 AND status IN ('pending', 'approved')", [c.id, user.id]);
    return this.detail(user, slug);
  }

  async image(entryId: string, size: 'full' | 'thumb'): Promise<Buffer> {
    const e = await this.db.one<{ image: Buffer }>(
      `SELECT ${size === 'thumb' ? 'e.thumb' : 'e.image'} AS image FROM contest_entries e JOIN contests c ON c.id = e.contest_id
        WHERE e.id = $1 AND e.status = 'approved' AND c.status <> 'draft'`,
      [entryId],
    );
    if (!e) throw AppError.notFound('entry_not_found', 'Entry not found');
    return e.image;
  }

  async vote(user: AuthenticatedUser, slug: string, entryId: string): Promise<ContestDetail> {
    const c = await this.publicContest(slug);
    if (this.phase(c) !== 'voting') throw AppError.conflict('voting_closed', 'Voting is not open');
    if (!user.emailVerified) throw AppError.forbidden('email_not_verified', 'Verify your email to vote');
    await this.db.transaction(async (tx) => {
      const e = (await tx.query<{ user_id: string }>("SELECT user_id FROM contest_entries WHERE id = $1 AND contest_id = $2 AND status = 'approved'", [entryId, c.id])).rows[0];
      if (!e) throw AppError.notFound('entry_not_found', 'Entry not found');
      if (e.user_id === user.id) throw new AppError('own_entry', 'You cannot vote for your own entry', HttpStatus.UNPROCESSABLE_ENTITY);
      const prev = (await tx.query<{ entry_id: string }>('SELECT entry_id FROM contest_votes WHERE contest_id = $1 AND user_id = $2 FOR UPDATE', [c.id, user.id])).rows[0];
      if (prev?.entry_id === entryId) return;
      if (prev) await tx.query('UPDATE contest_entries SET vote_count = vote_count - 1 WHERE id = $1', [prev.entry_id]);
      await tx.query(
        `INSERT INTO contest_votes (contest_id, user_id, entry_id) VALUES ($1, $2, $3)
         ON CONFLICT (contest_id, user_id) DO UPDATE SET entry_id = EXCLUDED.entry_id, created_at = now()`,
        [c.id, user.id, entryId],
      );
      await tx.query('UPDATE contest_entries SET vote_count = vote_count + 1 WHERE id = $1', [entryId]);
    });
    return this.detail(user, slug);
  }

  // ---------------------------------------------------------------- admin

  private async adminView(c: ContestRow): Promise<AdminContest> {
    const [pending, ranking, prize] = await Promise.all([
      this.db.query<{ id: string; title: string; description: string | null; author: string; thumb: Buffer; created_at: Date }>(
        `SELECT e.id, e.title, e.description, COALESCE(p.display_name, p.username, '—') AS author, e.thumb, e.created_at
           FROM contest_entries e JOIN profiles p ON p.user_id = e.user_id WHERE e.contest_id = $1 AND e.status = 'pending' ORDER BY e.created_at`,
        [c.id],
      ),
      this.db.query<{ id: string; title: string; author: string; vote_count: number }>(
        `SELECT e.id, e.title, COALESCE(p.display_name, p.username, '—') AS author, e.vote_count
           FROM contest_entries e JOIN profiles p ON p.user_id = e.user_id WHERE e.contest_id = $1 AND e.status = 'approved' ORDER BY e.vote_count DESC, e.created_at`,
        [c.id],
      ),
      this.db.one<{ id: string; delivered: boolean }>("SELECT id, delivered_at IS NOT NULL AS delivered FROM prizes WHERE source = 'contest' AND source_id = $1", [c.id]),
    ]);
    return {
      ...(await this.summary(c)),
      status: c.status,
      pending: pending.rows.map((r) => ({ id: r.id, title: r.title, description: r.description, author: r.author, thumbDataUrl: `data:image/webp;base64,${r.thumb.toString('base64')}`, createdAt: r.created_at.toISOString() })),
      ranking: ranking.rows.map((r) => ({ id: r.id, title: r.title, author: r.author, voteCount: r.vote_count })),
      prizeId: prize?.id ?? null,
      prizeDelivered: prize?.delivered ?? false,
    };
  }

  async adminList(): Promise<AdminContest[]> {
    const { rows } = await this.db.query<ContestRow>(`${CONTEST_SELECT} ORDER BY c.created_at DESC LIMIT 50`);
    return Promise.all(rows.map((c) => this.adminView(c)));
  }

  async create(admin: AuthenticatedUser, input: ContestCreateInput): Promise<AdminContest> {
    let universeId: string | null = null;
    if (input.universeSlug) {
      universeId = (await this.db.one<{ id: string }>('SELECT id FROM universes WHERE slug = $1', [input.universeSlug]))?.id ?? null;
      if (!universeId) throw AppError.notFound('universe_not_found', 'Universe not found');
    }
    try {
      const { rows } = await this.db.query<{ id: string }>(
        `INSERT INTO contests (slug, title, description, rules, prize, universe_id, submissions_open_at, submissions_close_at, voting_close_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [input.slug, input.title, input.description, input.rules, input.prize, universeId, input.submissionsOpenAt, input.submissionsCloseAt, input.votingCloseAt, admin.id],
      );
      await this.audit.log(this.db.pool, { actorUserId: admin.id, action: 'admin.contest_created', targetType: 'contest', targetId: rows[0]!.id });
      return this.adminView(await this.load(this.db.pool, 'c.id = $1', rows[0]!.id));
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw AppError.conflict('slug_taken', 'This address is already used by another contest');
      throw e;
    }
  }

  async update(admin: AuthenticatedUser, id: string, input: ContestUpdateInput): Promise<AdminContest> {
    const c = await this.load(this.db.pool, 'c.id = $1', id);
    if (c.status === 'finished' || c.status === 'cancelled') throw AppError.conflict('contest_locked', 'This contest can no longer be edited');
    const map: Record<string, string> = { title: 'title', description: 'description', rules: 'rules', prize: 'prize', submissionsOpenAt: 'submissions_open_at', submissionsCloseAt: 'submissions_close_at', votingCloseAt: 'voting_close_at' };
    const sets: string[] = [];
    const vals: unknown[] = [id];
    for (const [k, v] of Object.entries(input)) {
      vals.push(v);
      sets.push(`${map[k]} = $${vals.length}`);
    }
    try {
      await this.db.query(`UPDATE contests SET ${sets.join(', ')} WHERE id = $1`, vals);
    } catch (e) {
      if ((e as { code?: string }).code === '23514') throw new AppError('invalid_window', 'Dates must be in order: open < close < voting end', HttpStatus.UNPROCESSABLE_ENTITY);
      throw e;
    }
    await this.audit.log(this.db.pool, { actorUserId: admin.id, action: 'admin.contest_updated', targetType: 'contest', targetId: id, metadata: { fields: Object.keys(input) } });
    return this.adminView(await this.load(this.db.pool, 'c.id = $1', id));
  }

  async setStatus(admin: AuthenticatedUser, id: string, to: 'published' | 'cancelled'): Promise<AdminContest> {
    const c = await this.load(this.db.pool, 'c.id = $1', id);
    const allowed = to === 'published' ? c.status === 'draft' : c.status === 'draft' || c.status === 'published';
    if (!allowed) throw AppError.conflict('contest_locked', 'Invalid status change');
    await this.db.query('UPDATE contests SET status = $2 WHERE id = $1', [id, to]);
    await this.audit.log(this.db.pool, { actorUserId: admin.id, action: `admin.contest_${to}`, targetType: 'contest', targetId: id });
    return this.adminView(await this.load(this.db.pool, 'c.id = $1', id));
  }

  async review(staff: AuthenticatedUser, entryId: string, action: 'approve' | 'reject'): Promise<void> {
    const r = await this.db.query(
      "UPDATE contest_entries SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1 AND status = 'pending' RETURNING contest_id",
      [entryId, action === 'approve' ? 'approved' : 'rejected', staff.id],
    );
    if (!r.rowCount) throw AppError.notFound('entry_not_found', 'Entry not found or already reviewed');
    await this.audit.log(this.db.pool, { actorUserId: staff.id, action: `moderation.contest_entry_${action}d`, targetType: 'contest_entry', targetId: entryId });
  }

  /** The jury's final decision, once voting has closed (the community vote informs it). */
  async declareWinner(admin: AuthenticatedUser, id: string, entryId: string): Promise<AdminContest> {
    const result = await this.db.transaction(async (tx) => {
      const c = await this.load(tx, 'c.id = $1', id, true);
      if (this.phase(c) !== 'judging') throw AppError.conflict('not_judging', 'The winner is chosen after voting closes');
      const e = (await tx.query<{ user_id: string }>("SELECT user_id FROM contest_entries WHERE id = $1 AND contest_id = $2 AND status = 'approved'", [entryId, id])).rows[0];
      if (!e) throw AppError.notFound('entry_not_found', 'Entry not found');
      await tx.query("UPDATE contests SET status = 'finished', winner_entry_id = $2 WHERE id = $1", [id, entryId]);
      await tx.query("INSERT INTO prizes (user_id, source, source_id, position, description) VALUES ($1, 'contest', $2, 1, $3)", [e.user_id, id, c.prize]);
      await this.audit.log(tx, { actorUserId: admin.id, action: 'admin.contest_winner', targetType: 'contest', targetId: id, metadata: { entryId } });
      return { userId: e.user_id, title: c.title, prize: c.prize };
    });
    await this.draws.notify(result.userId, 'prize_won', result.title, result.prize);
    return this.adminView(await this.load(this.db.pool, 'c.id = $1', id));
  }
}
