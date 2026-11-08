import { HttpStatus, Injectable } from '@nestjs/common';
import { FEATURE_ENGINE, PLAN_RANK, type MissionObjective, type SectionEngine } from '@fandom/shared';
import type { IdentityStanding, LoreEntry, MissionProgress, MissionSummary, UniverseEvent } from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { DatabaseService, type Queryable } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { EntitlementsService } from '../subscriptions/entitlements.service.js';
import { UniversesService } from '../universes/universes.service.js';
import { XpService } from '../xp/xp.service.js';
import { EVENT_SELECT, toEvent } from './event-room.service.js';

/** Counts real activity of a user inside a universe for a mission objective (optionally windowed). */
export async function objectiveProgress(
  db: Queryable,
  objective: MissionObjective,
  userId: string,
  universeId: string,
  window: { from: Date | null; to: Date | null },
): Promise<number> {
  const from = window.from ?? new Date(0);
  const to = window.to ?? new Date('9999-12-31');
  const q = async (sql: string) => Number((await db.query<{ n: number }>(sql, [userId, universeId, from, to])).rows[0]?.n ?? 0);
  switch (objective) {
    case 'quiz_complete':
      return q(`SELECT count(DISTINCT a.quiz_id)::int AS n FROM quiz_attempts a JOIN quizzes z ON z.id = a.quiz_id
                 WHERE a.user_id = $1 AND z.universe_id = $2 AND a.created_at BETWEEN $3 AND $4`);
    case 'quiz_perfect':
      return q(`SELECT count(DISTINCT a.quiz_id)::int AS n FROM quiz_attempts a JOIN quizzes z ON z.id = a.quiz_id
                 WHERE a.user_id = $1 AND z.universe_id = $2 AND z.kind = 'trivia' AND a.score = a.total AND a.created_at BETWEEN $3 AND $4`);
    case 'forum_topic':
      return q(`SELECT count(*)::int AS n FROM forum_topics WHERE author_id = $1 AND universe_id = $2 AND status = 'visible' AND created_at BETWEEN $3 AND $4`);
    case 'forum_reply':
      return q(`SELECT count(*)::int AS n FROM forum_replies r JOIN forum_topics t ON t.id = r.topic_id
                 WHERE r.author_id = $1 AND t.universe_id = $2 AND r.status = 'visible' AND t.author_id <> $1 AND r.created_at BETWEEN $3 AND $4`);
    case 'identity_set':
      return q(`SELECT count(*)::int AS n FROM universe_profiles WHERE user_id = $1 AND universe_id = $2 AND identity ? 'key' AND $3::timestamptz <= $4::timestamptz`);
    case 'event_join':
      return q(`SELECT count(*)::int AS n FROM event_participants p JOIN events e ON e.id = p.event_id
                 WHERE p.user_id = $1 AND e.universe_id = $2 AND p.registered_at BETWEEN $3 AND $4`);
    case 'hangman_win':
      return q(`SELECT count(*)::int AS n FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'hangman' AND status = 'won' AND finished_at BETWEEN $3 AND $4`);
    case 'daily_complete':
      return q(`SELECT count(*)::int AS n FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'daily' AND status <> 'active' AND finished_at BETWEEN $3 AND $4`);
    case 'daily_perfect':
      return q(`SELECT count(*)::int AS n FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'daily' AND status <> 'active' AND total > 0 AND score = total AND finished_at BETWEEN $3 AND $4`);
    case 'survival_score':
      return q(`SELECT COALESCE(max(score), 0)::int AS n FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'survival' AND status <> 'active' AND finished_at BETWEEN $3 AND $4`);
    case 'speed_score':
      // Best number of correct answers in a single speed round.
      return q(`SELECT COALESCE(max(score), 0)::int AS n FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'speed' AND status <> 'active' AND finished_at BETWEEN $3 AND $4`);
  }
}

@Injectable()
export class SectionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly universes: UniversesService,
    private readonly entitlements: EntitlementsService,
    private readonly xp: XpService,
  ) {}

  /** Resolves the universe and checks that `section` is one of its features of the given engine. */
  async universeWith(slug: string, section: string | null, engine: SectionEngine) {
    const universe = await this.universes.getActive(slug);
    const ok = section
      ? universe.features.includes(section) && FEATURE_ENGINE[section] === engine
      : universe.features.some((f) => FEATURE_ENGINE[f] === engine);
    if (!ok) throw AppError.notFound('section_not_found', 'This section does not exist in this universe');
    return universe;
  }

  async assertMember(userId: string, universeId: string): Promise<Record<string, unknown>> {
    const m = await this.db.one<{ identity: Record<string, unknown> }>(
      `SELECT COALESCE(p.identity, '{}'::jsonb) AS identity FROM universe_members m
         LEFT JOIN universe_profiles p ON p.universe_id = m.universe_id AND p.user_id = m.user_id
        WHERE m.universe_id = $1 AND m.user_id = $2`,
      [universeId, userId],
    );
    if (!m) throw AppError.forbidden('membership_required', 'Join this universe first');
    return m.identity;
  }

  // ---------------------------------------------------------------- archive

  async archive(slug: string, section: string): Promise<LoreEntry[]> {
    const universe = await this.universeWith(slug, section, 'archive');
    return this.redis.cached(`archive:v1:${universe.id}:${section}`, 120, async () => {
      const { rows } = await this.db.query<{ id: string; slug: string; section: string; title: LoreEntry['title']; subtitle: LoreEntry['subtitle']; summary: LoreEntry['summary']; tags: string[] }>(
        `SELECT id, slug, section, title, subtitle, summary, tags FROM lore_entries
          WHERE universe_id = $1 AND section = $2 AND status = 'published' ORDER BY sort_order, slug`,
        [universe.id, section],
      );
      return rows.map((r) => ({ ...r }));
    });
  }

  // ---------------------------------------------------------------- missions

  async missions(slug: string): Promise<MissionSummary[]> {
    const universe = await this.universeWith(slug, null, 'missions');
    const { rows } = await this.db.query<{
      id: string; slug: string; section: string; title: MissionSummary['title']; description: MissionSummary['description'];
      objective_type: string; objective_count: number; xp_reward: number; ends_at: Date | null; premium_plan: 'plus' | 'ultra' | null;
    }>(
      `SELECT id, slug, section, title, description, objective_type, objective_count, xp_reward, ends_at, premium_plan FROM missions
        WHERE universe_id = $1 AND status = 'published' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
          AND section = ANY($2::text[])
        ORDER BY section, premium_plan NULLS FIRST, sort_order, slug`,
      [universe.id, universe.features],
    );
    return rows.map((r) => ({
      id: r.id, slug: r.slug, section: r.section, title: r.title, description: r.description,
      objectiveType: r.objective_type, objectiveCount: r.objective_count, xpReward: r.xp_reward, endsAt: r.ends_at?.toISOString() ?? null,
      premiumPlan: r.premium_plan,
    }));
  }

  async missionProgress(user: AuthenticatedUser, slug: string): Promise<MissionProgress[]> {
    const universe = await this.universeWith(slug, null, 'missions');
    const { rows } = await this.db.query<{ id: string; objective_type: MissionObjective; objective_count: number; starts_at: Date | null; ends_at: Date | null; completed_at: Date | null }>(
      `SELECT m.id, m.objective_type, m.objective_count, m.starts_at, m.ends_at, c.completed_at
         FROM missions m LEFT JOIN mission_completions c ON c.mission_id = m.id AND c.user_id = $2
        WHERE m.universe_id = $1 AND m.status = 'published'`,
      [universe.id, user.id],
    );
    return Promise.all(
      rows.map(async (m) => {
        const progress = m.completed_at
          ? m.objective_count
          : Math.min(m.objective_count, await objectiveProgress(this.db.pool, m.objective_type, user.id, universe.id, { from: m.starts_at, to: m.ends_at }));
        return { missionId: m.id, progress, completed: Boolean(m.completed_at), completedAt: m.completed_at?.toISOString() ?? null };
      }),
    );
  }

  /** Verifies the objective against real activity, then records completion and XP exactly once. */
  async claimMission(user: AuthenticatedUser, missionId: string): Promise<MissionProgress & { xpAwarded: number; xpBonus: number }> {
    const m = await this.db.one<{ id: string; universe_id: string; objective_type: MissionObjective; objective_count: number; xp_reward: number; starts_at: Date | null; ends_at: Date | null; premium_plan: 'plus' | 'ultra' | null }>(
      "SELECT id, universe_id, objective_type, objective_count, xp_reward, starts_at, ends_at, premium_plan FROM missions WHERE id = $1 AND status = 'published'",
      [missionId],
    );
    if (!m) throw AppError.notFound('mission_not_found', 'Mission not found');
    if (m.ends_at && m.ends_at <= new Date()) throw AppError.conflict('mission_ended', 'This mission has ended');
    await this.assertMember(user.id, m.universe_id);
    if (m.premium_plan) {
      const { planCode } = await this.entitlements.snapshot(user.id);
      if (PLAN_RANK[planCode] < PLAN_RANK[m.premium_plan]) {
        throw new AppError('premium_required', `Requires ${m.premium_plan}`, HttpStatus.FORBIDDEN, { requiredPlan: m.premium_plan });
      }
    }
    return this.db.transaction(async (tx) => {
      const progress = await objectiveProgress(tx, m.objective_type, user.id, m.universe_id, { from: m.starts_at, to: m.ends_at });
      if (progress < m.objective_count) {
        throw new AppError('mission_incomplete', 'Objective not reached yet', HttpStatus.CONFLICT, { progress, required: m.objective_count });
      }
      const ins = await tx.query<{ completed_at: Date }>(
        'INSERT INTO mission_completions (mission_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING completed_at',
        [m.id, user.id],
      );
      let xpAwarded = 0;
      let xpBonus = 0;
      if (ins.rowCount) {
        const r = await this.xp.awardWithBonus(tx, {
          userId: user.id, universeId: m.universe_id, amount: m.xp_reward, source: 'mission', sourceRef: m.id,
          idempotencyKey: `mission:${m.id}:${user.id}`,
        });
        xpAwarded = r.granted ? m.xp_reward : 0;
        xpBonus = r.bonus;
      }
      const done = await tx.query<{ completed_at: Date }>('SELECT completed_at FROM mission_completions WHERE mission_id = $1 AND user_id = $2', [m.id, user.id]);
      return { missionId: m.id, progress: m.objective_count, completed: true, completedAt: done.rows[0]!.completed_at.toISOString(), xpAwarded, xpBonus };
    });
  }

  // ---------------------------------------------------------------- events

  async events(slug: string): Promise<UniverseEvent[]> {
    const universe = await this.universeWith(slug, 'events', 'events');
    const { rows } = await this.db.query<Parameters<typeof toEvent>[0]>(
      `${EVENT_SELECT} WHERE e.universe_id = $1 AND e.status IN ('published', 'cancelled') AND e.ends_at > now() - interval '30 days' ORDER BY e.starts_at`,
      [universe.id],
    );
    return rows.map(toEvent);
  }

  async myEvents(user: AuthenticatedUser, slug: string): Promise<string[]> {
    const universe = await this.universeWith(slug, 'events', 'events');
    const { rows } = await this.db.query<{ event_id: string }>(
      'SELECT p.event_id FROM event_participants p JOIN events e ON e.id = p.event_id WHERE p.user_id = $1 AND e.universe_id = $2',
      [user.id, universe.id],
    );
    return rows.map((r) => r.event_id);
  }

  /** Registration: member only, before the end, capacity and Premium plan enforced on the server. */
  async register(user: AuthenticatedUser, eventId: string): Promise<UniverseEvent> {
    const e = await this.db.one<{ universe_id: string; ends_at: Date; premium_plan: 'plus' | 'ultra' | null; capacity: number | null; status: string; slug: string }>(
      "SELECT e.universe_id, e.ends_at, e.premium_plan, e.capacity, e.status, u.slug FROM events e JOIN universes u ON u.id = e.universe_id WHERE e.id = $1",
      [eventId],
    );
    if (!e || e.status !== 'published') throw AppError.notFound('event_not_found', 'Event not found');
    if (e.ends_at <= new Date()) throw AppError.conflict('event_ended', 'This event has ended');
    await this.assertMember(user.id, e.universe_id);
    if (e.premium_plan) {
      const plan = (await this.entitlements.snapshot(user.id)).planCode;
      if (PLAN_RANK[plan] < PLAN_RANK[e.premium_plan]) {
        throw new AppError('premium_required', `Requires ${e.premium_plan}`, HttpStatus.FORBIDDEN, { requiredPlan: e.premium_plan });
      }
    }
    await this.db.transaction(async (tx) => {
      const locked = await tx.query<{ participant_count: number }>('SELECT participant_count FROM events WHERE id = $1 FOR UPDATE', [eventId]);
      const already = await tx.query('SELECT 1 FROM event_participants WHERE event_id = $1 AND user_id = $2', [eventId, user.id]);
      if (already.rowCount) return;
      if (e.capacity && locked.rows[0]!.participant_count >= e.capacity) throw AppError.conflict('event_full', 'This event is full');
      await tx.query('INSERT INTO event_participants (event_id, user_id) VALUES ($1, $2)', [eventId, user.id]);
    });
    return (await this.events(e.slug)).find((x) => x.id === eventId)!;
  }

  async unregister(user: AuthenticatedUser, eventId: string): Promise<void> {
    const res = await this.db.query('DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2', [eventId, user.id]);
    if (!res.rowCount) throw AppError.notFound('registration_not_found', 'You are not registered');
  }

  // ---------------------------------------------------------------- identity standings (house cup)

  async standings(slug: string): Promise<IdentityStanding[]> {
    const universe = await this.universeWith(slug, 'house_cup', 'house_cup');
    return this.redis.cached(`standings:v1:${universe.id}`, 30, async () => {
      const { rows } = await this.db.query<{ identity: string; members: number; xp: number }>(
        `SELECT p.identity->>'key' AS identity, count(*)::int AS members, COALESCE(sum(p.xp), 0)::int AS xp
           FROM universe_profiles p JOIN users u ON u.id = p.user_id AND u.status = 'active'
          WHERE p.universe_id = $1 AND p.identity ? 'key'
          GROUP BY 1 ORDER BY xp DESC, members DESC`,
        [universe.id],
      );
      const options = (universe.identityConfig as { options?: { key: string }[] }).options ?? [];
      // Every identity appears, even with zero members.
      return options
        .map((o) => rows.find((r) => r.identity === o.key) ?? { identity: o.key, members: 0, xp: 0 })
        .sort((a, b) => b.xp - a.xp || b.members - a.members);
    });
  }
}
