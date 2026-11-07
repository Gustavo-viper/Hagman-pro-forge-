import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Locale } from '@fandom/shared';
import type { CreateEventInput, UpdateEventInput } from '@fandom/schemas';
import type { AdminEvent, EventLeaderboardEntry, EventMessage, EventRoom, UniverseEvent } from '@fandom/types';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { MailService } from '../mail/mail.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';

const OPEN_BEFORE_MS = 30 * 60_000;
const CLOSE_AFTER_MS = 60 * 60_000;
const MESSAGE_COOLDOWN_MS = 2_000;
const MODERATORS = ['super_admin', 'admin', 'global_moderator'];

export const roomChannel = (eventId: string) => `event-room:${eventId}`;

interface EventRow {
  id: string; universe_id: string; universe_slug: string; slug: string; title: UniverseEvent['title']; description: UniverseEvent['description'];
  kind: UniverseEvent['kind']; starts_at: Date; ends_at: Date; premium_plan: UniverseEvent['premiumPlan']; capacity: number | null;
  participant_count: number; status: UniverseEvent['status']; external_url: string | null; quiz_id: string | null;
}

export const EVENT_SELECT = `
  SELECT e.id, e.universe_id, u.slug AS universe_slug, e.slug, e.title, e.description, e.kind, e.starts_at, e.ends_at,
         e.premium_plan, e.capacity, e.participant_count, e.status, e.external_url, e.quiz_id
    FROM events e JOIN universes u ON u.id = e.universe_id`;

export function toEvent(r: EventRow): UniverseEvent {
  return {
    id: r.id, slug: r.slug, title: r.title, description: r.description, kind: r.kind,
    startsAt: r.starts_at.toISOString(), endsAt: r.ends_at.toISOString(), premiumPlan: r.premium_plan,
    capacity: r.capacity, participantCount: r.participant_count, hasQuiz: Boolean(r.quiz_id),
    hasExternalLink: Boolean(r.external_url), status: r.status,
  };
}

const toAdmin = (r: EventRow): AdminEvent => ({ ...toEvent(r), universeSlug: r.universe_slug, externalUrl: r.external_url, quizId: r.quiz_id });

@Injectable()
export class EventRoomService {
  private readonly logger = new Logger(EventRoomService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async load(eventId: string): Promise<EventRow> {
    const e = await this.db.one<EventRow>(`${EVENT_SELECT} WHERE e.id = $1`, [eventId]);
    if (!e || e.status === 'draft') throw AppError.notFound('event_not_found', 'Event not found');
    return e;
  }

  private window(e: EventRow) {
    const opensAt = new Date(e.starts_at.getTime() - OPEN_BEFORE_MS);
    const closesAt = new Date(e.ends_at.getTime() + CLOSE_AFTER_MS);
    const now = Date.now();
    return { opensAt, closesAt, open: e.status === 'published' && now >= opensAt.getTime() && now <= closesAt.getTime() };
  }

  /** Only registered participants (or moderators) can see the room. */
  private async assertAccess(user: AuthenticatedUser, e: EventRow): Promise<boolean> {
    const moderator = user.roles.some((r) => MODERATORS.includes(r));
    if (moderator) return true;
    const p = await this.db.one('SELECT 1 FROM event_participants WHERE event_id = $1 AND user_id = $2', [e.id, user.id]);
    if (!p) throw AppError.forbidden('registration_required', 'Register for the event to enter the room');
    return false;
  }

  private async messages(eventId: string, userId: string, limit = 100): Promise<EventMessage[]> {
    const { rows } = await this.db.query<{ id: number; body: string; created_at: Date; user_id: string; username: string | null; display_name: string | null; identity: string | null }>(
      `SELECT m.id, m.body, m.created_at, m.user_id, p.username, p.display_name, up.identity->>'key' AS identity
         FROM event_messages m
         JOIN events e ON e.id = m.event_id
         JOIN profiles p ON p.user_id = m.user_id
         LEFT JOIN universe_profiles up ON up.universe_id = e.universe_id AND up.user_id = m.user_id
        WHERE m.event_id = $1 AND m.status = 'visible'
        ORDER BY m.id DESC LIMIT $2`,
      [eventId, limit],
    );
    return rows.reverse().map((r) => ({
      id: Number(r.id), body: r.body, createdAt: r.created_at.toISOString(), mine: r.user_id === userId,
      author: { id: r.user_id, username: r.username, displayName: r.display_name, identity: r.identity },
    }));
  }

  /** Live quiz scoreboard: best score per participant on the event quiz while the room was open. */
  private async leaderboard(e: EventRow): Promise<EventLeaderboardEntry[]> {
    if (!e.quiz_id) return [];
    const { opensAt, closesAt } = this.window(e);
    const { rows } = await this.db.query<{ user_id: string; score: number; total: number; finished_at: Date; username: string | null; display_name: string | null }>(
      `SELECT DISTINCT ON (a.user_id) a.user_id, a.score, a.total, a.created_at AS finished_at, p.username, p.display_name
         FROM quiz_attempts a
         JOIN event_participants ep ON ep.event_id = $1 AND ep.user_id = a.user_id
         JOIN profiles p ON p.user_id = a.user_id
        WHERE a.quiz_id = $2 AND a.created_at BETWEEN $3 AND $4
        ORDER BY a.user_id, a.score DESC, a.created_at ASC`,
      [e.id, e.quiz_id, opensAt, closesAt],
    );
    return rows
      .sort((a, b) => b.score - a.score || a.finished_at.getTime() - b.finished_at.getTime())
      .slice(0, 50)
      .map((r, i) => ({ rank: i + 1, userId: r.user_id, username: r.username, displayName: r.display_name, score: r.score, total: r.total, finishedAt: r.finished_at.toISOString() }));
  }

  async room(user: AuthenticatedUser, eventId: string): Promise<EventRoom> {
    const e = await this.load(eventId);
    const canModerate = await this.assertAccess(user, e);
    const { opensAt, closesAt, open } = this.window(e);
    const quiz = e.quiz_id
      ? await this.db.one<{ id: string; title: EventRoom['event']['title']; n: number }>(
          'SELECT q.id, q.title, (SELECT count(*)::int FROM questions x WHERE x.quiz_id = q.id) AS n FROM quizzes q WHERE q.id = $1',
          [e.quiz_id],
        )
      : null;
    return {
      event: toEvent(e),
      universeSlug: e.universe_slug,
      opensAt: opensAt.toISOString(),
      closesAt: closesAt.toISOString(),
      open,
      // The external link is a perk of registered fans, revealed only while the room is open.
      externalUrl: open ? e.external_url : null,
      quiz: quiz ? { id: quiz.id, title: quiz.title, questionCount: quiz.n } : null,
      messages: open || canModerate ? await this.messages(e.id, user.id) : [],
      leaderboard: await this.leaderboard(e),
      canModerate,
    };
  }

  /** Access check used by the SSE stream before subscribing. */
  async assertStream(user: AuthenticatedUser, eventId: string): Promise<void> {
    const e = await this.load(eventId);
    await this.assertAccess(user, e);
    if (!this.window(e).open) throw AppError.conflict('room_closed', 'The room is closed');
  }

  async post(user: AuthenticatedUser, eventId: string, body: string): Promise<EventMessage> {
    const e = await this.load(eventId);
    await this.assertAccess(user, e);
    if (!this.window(e).open) throw AppError.conflict('room_closed', 'The room is closed');
    const last = await this.db.one<{ created_at: Date }>('SELECT created_at FROM event_messages WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [user.id]);
    if (last && Date.now() - last.created_at.getTime() < MESSAGE_COOLDOWN_MS) {
      throw new AppError('posting_too_fast', 'Slow down a little', HttpStatus.TOO_MANY_REQUESTS);
    }
    const { rows } = await this.db.query<{ id: number }>('INSERT INTO event_messages (event_id, user_id, body) VALUES ($1, $2, $3) RETURNING id', [e.id, user.id, body]);
    const msg = (await this.messages(e.id, user.id, 5)).find((m) => m.id === Number(rows[0]!.id))!;
    await this.realtime.publish(roomChannel(e.id), { type: 'message', message: { ...msg, mine: false } });
    return msg;
  }

  async removeMessage(user: AuthenticatedUser, eventId: string, messageId: number): Promise<void> {
    const moderator = user.roles.some((r) => MODERATORS.includes(r));
    const res = await this.db.query<{ id: number }>(
      `UPDATE event_messages SET status = $4 WHERE id = $1 AND event_id = $2 AND status = 'visible' AND ($3 OR user_id = $5) RETURNING id`,
      [messageId, eventId, moderator, moderator ? 'hidden' : 'deleted', user.id],
    );
    if (!res.rowCount) throw AppError.notFound('message_not_found', 'Message not found');
    if (moderator) await this.audit.log(this.db.pool, { actorUserId: user.id, action: 'moderation.event_message_hidden', targetType: 'event_message', targetId: String(messageId) });
    await this.realtime.publish(roomChannel(eventId), { type: 'removed', id: messageId });
  }

  async notifyLeaderboard(eventId: string): Promise<void> {
    const e = await this.load(eventId);
    await this.realtime.publish(roomChannel(e.id), { type: 'leaderboard', leaderboard: await this.leaderboard(e) });
  }

  // ---------------------------------------------------------------- admin

  async adminList(): Promise<AdminEvent[]> {
    const { rows } = await this.db.query<EventRow>(`${EVENT_SELECT} WHERE e.ends_at > now() - interval '60 days' ORDER BY e.starts_at`);
    return rows.map(toAdmin);
  }

  private async validateQuiz(quizId: string | null | undefined, universeId: string): Promise<void> {
    if (!quizId) return;
    const q = await this.db.one("SELECT 1 FROM quizzes WHERE id = $1 AND universe_id = $2 AND kind = 'trivia'", [quizId, universeId]);
    if (!q) throw new AppError('invalid_quiz', 'Quiz must be a trivia quiz of the same universe', HttpStatus.UNPROCESSABLE_ENTITY);
  }

  async create(staff: AuthenticatedUser, input: CreateEventInput): Promise<AdminEvent> {
    const u = await this.db.one<{ id: string; features: string[] }>(
      "SELECT u.id, s.features FROM universes u JOIN universe_settings s ON s.universe_id = u.id WHERE u.slug = $1 AND u.status = 'active'",
      [input.universeSlug],
    );
    if (!u) throw AppError.notFound('universe_not_found', 'Universe not found');
    if (!u.features.includes('events')) throw new AppError('section_not_found', 'Universe has no events section', HttpStatus.UNPROCESSABLE_ENTITY);
    await this.validateQuiz(input.quizId, u.id);
    const slug = `${input.title['pt-BR'].normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'evento'}-${Date.now().toString(36)}`;
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO events (universe_id, slug, title, description, kind, starts_at, ends_at, capacity, premium_plan, external_url, quiz_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [u.id, slug, JSON.stringify(input.title), JSON.stringify(input.description), input.kind, input.startsAt, input.endsAt,
       input.capacity, input.premiumPlan, input.externalUrl, input.quizId, staff.id],
    );
    await this.audit.log(this.db.pool, { actorUserId: staff.id, action: 'admin.event_created', targetType: 'event', targetId: rows[0]!.id, metadata: { universe: input.universeSlug } });
    return toAdmin(await this.load(rows[0]!.id));
  }

  async update(staff: AuthenticatedUser, eventId: string, input: UpdateEventInput): Promise<AdminEvent> {
    const e = await this.load(eventId);
    if (e.status === 'cancelled') throw AppError.conflict('event_cancelled', 'Cancelled events cannot be edited');
    await this.validateQuiz(input.quizId, e.universe_id);
    const starts = input.startsAt ? new Date(input.startsAt) : e.starts_at;
    const ends = input.endsAt ? new Date(input.endsAt) : e.ends_at;
    if (ends <= starts) throw new AppError('validation_failed', 'End must be after start', HttpStatus.UNPROCESSABLE_ENTITY);
    const sets: string[] = [];
    const params: unknown[] = [eventId];
    const set = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
    if (input.title) set('title', JSON.stringify(input.title));
    if (input.description) set('description', JSON.stringify(input.description));
    if (input.startsAt) set('starts_at', input.startsAt);
    if (input.endsAt) set('ends_at', input.endsAt);
    if (input.capacity !== undefined) set('capacity', input.capacity);
    if (input.premiumPlan !== undefined) set('premium_plan', input.premiumPlan);
    if (input.externalUrl !== undefined) set('external_url', input.externalUrl);
    if (input.quizId !== undefined) set('quiz_id', input.quizId);
    // Moving the start re-arms the reminders.
    const rearm = input.startsAt && new Date(input.startsAt).getTime() !== e.starts_at.getTime();
    await this.db.transaction(async (tx) => {
      await tx.query(`UPDATE events SET ${sets.join(', ')} WHERE id = $1`, params);
      if (rearm) await tx.query('UPDATE event_participants SET reminded_24h_at = NULL, reminded_1h_at = NULL WHERE event_id = $1', [eventId]);
      await this.audit.log(tx, { actorUserId: staff.id, action: 'admin.event_updated', targetType: 'event', targetId: eventId, metadata: { fields: Object.keys(input) } });
    });
    return toAdmin(await this.load(eventId));
  }

  /** Cancels the event and emails every registered participant. */
  async cancel(staff: AuthenticatedUser, eventId: string): Promise<AdminEvent> {
    const e = await this.load(eventId);
    if (e.status === 'cancelled') throw AppError.conflict('event_cancelled', 'Event already cancelled');
    await this.db.transaction(async (tx) => {
      await tx.query("UPDATE events SET status = 'cancelled' WHERE id = $1", [eventId]);
      await this.audit.log(tx, { actorUserId: staff.id, action: 'admin.event_cancelled', targetType: 'event', targetId: eventId });
    });
    const { rows } = await this.db.query<{ email: string; locale: Locale; timezone: string }>(
      `SELECT u.email, p.locale, p.timezone FROM event_participants ep
         JOIN users u ON u.id = ep.user_id AND u.status = 'active' JOIN profiles p ON p.user_id = ep.user_id
        WHERE ep.event_id = $1`,
      [eventId],
    );
    const base = this.env.APP_PUBLIC_URL.replace(/\/+$/, '');
    for (const r of rows) {
      try {
        await this.mail.send({
          to: r.email, template: 'event_cancelled', locale: r.locale, link: `${base}/universes/${e.universe_slug}?tab=events`,
          details: {
            title: e.title[r.locale] ?? e.title['pt-BR'],
            when: new Intl.DateTimeFormat(r.locale, { dateStyle: 'full', timeStyle: 'short', timeZone: r.timezone }).format(e.starts_at),
          },
        });
      } catch (error) {
        this.logger.error(`cancel email failed: ${(error as Error).message}`);
      }
    }
    await this.realtime.publish(roomChannel(eventId), { type: 'cancelled' });
    return toAdmin(await this.load(eventId));
  }
}
