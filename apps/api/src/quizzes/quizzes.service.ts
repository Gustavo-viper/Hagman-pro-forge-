import { HttpStatus, Injectable } from '@nestjs/common';
import { levelFromXp } from '@fandom/shared';
import type { QuizAttemptInput, RankingQuery } from '@fandom/schemas';
import type {
  LocalizedText,
  QuizAttemptResult,
  QuizDetail,
  QuizProgress,
  QuizSummary,
  RankingEntry,
  UniverseMembership,
} from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { planBadge } from '../common/plan-badge.js';
import { DatabaseService } from '../database/database.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { RedisService } from '../redis/redis.service.js';
import { UniversesService } from '../universes/universes.service.js';
import { XpService } from '../xp/xp.service.js';

interface QuizRow {
  id: string;
  slug: string;
  kind: QuizSummary['kind'];
  title: LocalizedText;
  description: LocalizedText;
  difficulty: QuizSummary['difficulty'];
  xp_reward: number;
  sets_identity: boolean;
  question_count: number;
  universe_id: string;
  universe_slug: string;
}

interface QuestionRow {
  id: string;
  position: number;
  prompt: LocalizedText;
  options: { key: string; text: LocalizedText; identity?: string }[];
  correct_key: string | null;
  explanation: LocalizedText | null;
}

const toSummary = (q: QuizRow): QuizSummary => ({
  id: q.id,
  slug: q.slug,
  kind: q.kind,
  title: q.title,
  description: q.description,
  difficulty: q.difficulty,
  xpReward: q.xp_reward,
  setsIdentity: q.sets_identity,
  questionCount: q.question_count,
});

const QUIZ_SELECT = `
  SELECT q.id, q.slug, q.kind, q.title, q.description, q.difficulty, q.xp_reward, q.sets_identity,
         q.universe_id, u.slug AS universe_slug,
         (SELECT count(*)::int FROM questions x WHERE x.quiz_id = q.id) AS question_count
    FROM quizzes q JOIN universes u ON u.id = q.universe_id
   WHERE q.status = 'published' AND u.status = 'active'`;

/**
 * Personality result: the identity chosen most often. Ties go to the tied identity picked
 * most recently (later questions weigh as tie-breakers). Deterministic.
 */
export function personalityResult(picks: string[]): string | null {
  const counts = new Map<string, number>();
  for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1);
  const max = Math.max(0, ...counts.values());
  for (let i = picks.length - 1; i >= 0; i--) if (counts.get(picks[i]!) === max) return picks[i]!;
  return null;
}

@Injectable()
export class QuizzesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly xp: XpService,
    private readonly universes: UniversesService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(universeSlug: string): Promise<QuizSummary[]> {
    await this.universes.getActive(universeSlug); // 404 for unknown universes
    return this.redis.cached(`quizzes:v1:${universeSlug}`, 60, async () => {
      const { rows } = await this.db.query<QuizRow>(`${QUIZ_SELECT} AND u.slug = $1 ORDER BY q.sort_order, q.slug`, [universeSlug]);
      return rows.map(toSummary);
    });
  }

  private async quiz(id: string): Promise<QuizRow> {
    const q = await this.db.one<QuizRow>(`${QUIZ_SELECT} AND q.id = $1`, [id]);
    if (!q) throw AppError.notFound('quiz_not_found', 'Quiz not found');
    return q;
  }

  private async questions(quizId: string): Promise<QuestionRow[]> {
    const { rows } = await this.db.query<QuestionRow>(
      'SELECT id, position, prompt, options, correct_key, explanation FROM questions WHERE quiz_id = $1 ORDER BY position',
      [quizId],
    );
    return rows;
  }

  /** Public view: never includes correct answers or identity mappings. */
  async detail(id: string): Promise<QuizDetail> {
    const q = await this.quiz(id);
    const questions = await this.questions(id);
    return {
      ...toSummary(q),
      universeSlug: q.universe_slug,
      questions: questions.map((x) => ({
        id: x.id,
        position: x.position,
        prompt: x.prompt,
        options: x.options.map((o) => ({ key: o.key, text: o.text })),
      })),
    };
  }

  private async assertMember(userId: string, universeId: string): Promise<void> {
    const m = await this.db.one('SELECT 1 FROM universe_members WHERE universe_id = $1 AND user_id = $2', [universeId, userId]);
    if (!m) throw AppError.forbidden('membership_required', 'Join this universe first');
  }

  async attempt(user: AuthenticatedUser, quizId: string, input: QuizAttemptInput): Promise<QuizAttemptResult> {
    const quiz = await this.quiz(quizId);
    await this.assertMember(user.id, quiz.universe_id);
    const questions = await this.questions(quizId);

    const answers: Record<string, string> = {};
    for (const q of questions) {
      const chosen = input.answers[q.id];
      if (!chosen || !q.options.some((o) => o.key === chosen)) {
        throw new AppError('incomplete_answers', 'Answer every question with a valid option', HttpStatus.UNPROCESSABLE_ENTITY);
      }
      answers[q.id] = chosen;
    }
    if (Object.keys(input.answers).length !== questions.length) {
      throw new AppError('incomplete_answers', 'Unknown questions in answers', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const total = questions.length;
    let score = 0;
    let identity: string | null = null;
    if (quiz.kind === 'trivia') {
      score = questions.filter((q) => q.correct_key === answers[q.id]).length;
    } else {
      score = total; // personality quizzes have no wrong answers
      identity = personalityResult(questions.map((q) => q.options.find((o) => o.key === answers[q.id])?.identity ?? '').filter(Boolean));
    }

    const result = await this.db.transaction(async (tx) => {
      // Serialize attempts of the same user on the same quiz (no double XP under concurrency).
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`quiz:${user.id}:${quizId}`]);
      const prev = await tx.query<{ earned: number }>(
        'SELECT COALESCE(sum(xp_awarded), 0)::int AS earned FROM quiz_attempts WHERE user_id = $1 AND quiz_id = $2',
        [user.id, quizId],
      );
      const earned = prev.rows[0]!.earned;
      // XP scales with the best score, capped at the quiz reward: improving pays the difference.
      const target = Math.round((quiz.xp_reward * score) / total);
      const xpAwarded = Math.max(0, target - earned);
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO quiz_attempts (user_id, quiz_id, answers, score, total, xp_awarded, result_identity)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [user.id, quizId, JSON.stringify(answers), score, total, xpAwarded, identity],
      );
      const attemptId = rows[0]!.id;
      let xpBonus = 0;
      if (xpAwarded > 0) {
        xpBonus = (await this.xp.awardWithBonus(tx, {
          userId: user.id, universeId: quiz.universe_id, amount: xpAwarded, source: 'quiz',
          sourceRef: quizId, idempotencyKey: `quiz:${attemptId}`,
        })).bonus;
        if (xpBonus > 0) await tx.query('UPDATE quiz_attempts SET xp_bonus = $2 WHERE id = $1', [attemptId, xpBonus]);
      }
      if (quiz.sets_identity && identity) {
        const cfg = await tx.query<{ type: string | null }>("SELECT identity_config->>'type' AS type FROM universe_settings WHERE universe_id = $1", [quiz.universe_id]);
        await tx.query(
          'UPDATE universe_profiles SET identity = $3 WHERE universe_id = $1 AND user_id = $2',
          [quiz.universe_id, user.id, JSON.stringify({ type: cfg.rows[0]?.type ?? 'identity', key: identity, source: 'quiz' })],
        );
      }
      return { attemptId, xpAwarded, xpBonus, xpRemaining: Math.max(0, quiz.xp_reward - earned - xpAwarded) };
    });

    // Live quiz nights: tell open event rooms that use this quiz to refresh their scoreboard.
    const rooms = await this.db.query<{ id: string }>(
      `SELECT e.id FROM events e JOIN event_participants p ON p.event_id = e.id AND p.user_id = $2
        WHERE e.quiz_id = $1 AND e.status = 'published'
          AND now() BETWEEN e.starts_at - interval '30 minutes' AND e.ends_at + interval '1 hour'`,
      [quizId, user.id],
    );
    for (const r of rooms.rows) await this.realtime.publish(`event-room:${r.id}`, { type: 'leaderboard-changed' });
    if (result.xpAwarded > 0) {
      await this.redis.invalidate(...['all', 'month', 'week'].map((p) => `ranking:v1:${quiz.universe_id}:${p}`));
    }
    return {
      attemptId: result.attemptId,
      score,
      total,
      xpAwarded: result.xpAwarded,
      xpBonus: result.xpBonus,
      xpRemaining: quiz.kind === 'trivia' ? result.xpRemaining : 0,
      resultIdentity: identity,
      review: questions.map((q) => ({
        questionId: q.id,
        chosen: answers[q.id]!,
        correctKey: q.correct_key,
        correct: q.correct_key ? q.correct_key === answers[q.id] : null,
        explanation: q.explanation,
      })),
    };
  }

  async progress(user: AuthenticatedUser, universeSlug: string): Promise<QuizProgress[]> {
    const { rows } = await this.db.query<{ quiz_id: string; attempts: number; best: number; total: number; earned: number }>(
      `SELECT a.quiz_id, count(*)::int AS attempts, max(a.score)::int AS best, max(a.total)::int AS total, sum(a.xp_awarded)::int AS earned
         FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id JOIN universes u ON u.id = q.universe_id
        WHERE a.user_id = $1 AND u.slug = $2
        GROUP BY a.quiz_id`,
      [user.id, universeSlug],
    );
    return rows.map((r) => ({ quizId: r.quiz_id, attempts: r.attempts, bestScore: r.best, total: r.total, xpEarned: r.earned }));
  }

  /** Manual identity choice for universes without a sorting quiz (e.g. faction, specialty). */
  async setIdentity(user: AuthenticatedUser, universeSlug: string, key: string): Promise<UniverseMembership> {
    const universe = await this.universes.getActive(universeSlug);
    await this.assertMember(user.id, universe.id);
    const cfg = universe.identityConfig as { type?: string; options?: { key: string }[] };
    if (!cfg.options?.some((o) => o.key === key)) throw new AppError('invalid_identity', 'Unknown identity option', HttpStatus.UNPROCESSABLE_ENTITY);
    const sorting = await this.db.one(
      "SELECT 1 FROM quizzes WHERE universe_id = $1 AND sets_identity AND status = 'published'",
      [universe.id],
    );
    if (sorting) throw AppError.conflict('identity_requires_quiz', 'This universe assigns identity through its quiz');
    await this.db.query('UPDATE universe_profiles SET identity = $3 WHERE universe_id = $1 AND user_id = $2', [
      universe.id, user.id, JSON.stringify({ type: cfg.type ?? 'identity', key, source: 'choice' }),
    ]);
    return (await this.universes.memberships(user.id)).find((m) => m.universeId === universe.id)!;
  }

  async ranking(universeSlug: string, q: RankingQuery): Promise<RankingEntry[]> {
    const universe = await this.universes.getActive(universeSlug);
    return this.redis.cached(`ranking:v1:${universe.id}:${q.period}`, 30, async () => {
      const since = q.period === 'week' ? "now() - interval '7 days'" : q.period === 'month' ? "now() - interval '30 days'" : null;
      const { rows } = since
        ? await this.db.query<{ user_id: string; xp: number; username: string | null; display_name: string | null; identity: Record<string, unknown>; plan: string }>(
            `SELECT t.user_id, sum(t.amount)::int AS xp, p.username, p.display_name, up.identity, public.effective_plan(t.user_id) AS plan
               FROM xp_transactions t
               JOIN users u ON u.id = t.user_id AND u.status = 'active'
               JOIN profiles p ON p.user_id = t.user_id
               JOIN universe_profiles up ON up.universe_id = t.universe_id AND up.user_id = t.user_id
              WHERE t.universe_id = $1 AND t.created_at > ${since}
              GROUP BY t.user_id, p.username, p.display_name, up.identity
             HAVING sum(t.amount) > 0
              ORDER BY xp DESC, t.user_id LIMIT 50`,
            [universe.id],
          )
        : await this.db.query<{ user_id: string; xp: number; username: string | null; display_name: string | null; identity: Record<string, unknown>; plan: string }>(
            `SELECT up.user_id, up.xp, p.username, p.display_name, up.identity, public.effective_plan(up.user_id) AS plan
               FROM universe_profiles up
               JOIN users u ON u.id = up.user_id AND u.status = 'active'
               JOIN profiles p ON p.user_id = up.user_id
              WHERE up.universe_id = $1 AND up.xp > 0
              ORDER BY up.xp DESC, up.user_id LIMIT 50`,
            [universe.id],
          );
      return rows.map((r, i) => ({
        rank: i + 1,
        userId: r.user_id,
        username: r.username,
        displayName: r.display_name,
        plan: planBadge(r.plan),
        xp: r.xp,
        level: levelFromXp(r.xp),
        identity: typeof r.identity?.key === 'string' ? r.identity.key : null,
      }));
    });
  }
}
