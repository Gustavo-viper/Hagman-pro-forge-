import { Injectable } from '@nestjs/common';
import { levelFromXp, PREMIUM_PERKS, type PlanCode } from '@fandom/shared';
import type { LocalizedText, PlayerStats } from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';
import { streakInfo } from '../games/games.service.js';

const PERIOD_DAYS = 30;

/** Detailed statistics for subscribers, computed from the real ledgers (XP, quizzes, games). */
@Injectable()
export class StatsService {
  constructor(private readonly db: DatabaseService) {}

  async stats(user: AuthenticatedUser): Promise<PlayerStats> {
    const prof = await this.db.one<{ tz: string; today: string; plan: PlanCode }>(
      `SELECT p.timezone AS tz, (now() AT TIME ZONE p.timezone)::date::text AS today, public.effective_plan(p.user_id) AS plan
         FROM profiles p WHERE p.user_id = $1`,
      [user.id],
    );
    const tz = prof?.tz ?? 'America/Sao_Paulo';
    const today = prof?.today ?? new Date().toISOString().slice(0, 10);
    const args = [user.id, tz, PERIOD_DAYS];
    const since = `((now() AT TIME ZONE $2)::date - ($3::int - 1))`;
    const [byDay, bySource, quiz, games, missions, universes, perUniverseQuiz, perUniverseGames, dailyDays] = await Promise.all([
      this.db.query<{ day: string; xp: number; bonus: number }>(
        `SELECT (created_at AT TIME ZONE $2)::date::text AS day,
                COALESCE(sum(amount) FILTER (WHERE source_ref IS NULL OR source_ref NOT LIKE 'premium:%'), 0)::int AS xp,
                COALESCE(sum(amount) FILTER (WHERE source_ref LIKE 'premium:%'), 0)::int AS bonus
           FROM xp_transactions WHERE user_id = $1 AND (created_at AT TIME ZONE $2)::date >= ${since}
          GROUP BY 1`,
        args,
      ),
      this.db.query<{ source: string; xp: number }>(
        `SELECT CASE WHEN source_ref LIKE 'premium:%' THEN 'premium' ELSE source END AS source, sum(amount)::int AS xp
           FROM xp_transactions WHERE user_id = $1 AND (created_at AT TIME ZONE $2)::date >= ${since}
          GROUP BY 1 HAVING sum(amount) > 0 ORDER BY 2 DESC`,
        args,
      ),
      this.db.one<{ completed: number; perfect: number; correct: number; asked: number }>(
        `SELECT count(DISTINCT a.quiz_id)::int AS completed,
                count(DISTINCT a.quiz_id) FILTER (WHERE q.kind = 'trivia' AND a.score = a.total)::int AS perfect,
                COALESCE(sum(a.score) FILTER (WHERE q.kind = 'trivia'), 0)::int AS correct,
                COALESCE(sum(a.total) FILTER (WHERE q.kind = 'trivia'), 0)::int AS asked
           FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.user_id = $1`,
        [user.id],
      ),
      this.db.one<{ n: number }>("SELECT count(*)::int AS n FROM game_sessions WHERE user_id = $1 AND status <> 'active'", [user.id]),
      this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM mission_completions WHERE user_id = $1', [user.id]),
      this.db.query<{ id: string; slug: string; name: LocalizedText; xp: number }>(
        `SELECT u.id, u.slug, u.name, COALESCE(up.xp, 0)::int AS xp
           FROM universe_members m JOIN universes u ON u.id = m.universe_id
           LEFT JOIN universe_profiles up ON up.universe_id = m.universe_id AND up.user_id = m.user_id
          WHERE m.user_id = $1 ORDER BY up.xp DESC NULLS LAST, u.slug`,
        [user.id],
      ),
      this.db.query<{ universe_id: string; completed: number; correct: number; asked: number }>(
        `SELECT q.universe_id, count(DISTINCT a.quiz_id)::int AS completed,
                COALESCE(sum(a.score) FILTER (WHERE q.kind = 'trivia'), 0)::int AS correct,
                COALESCE(sum(a.total) FILTER (WHERE q.kind = 'trivia'), 0)::int AS asked
           FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.user_id = $1 GROUP BY q.universe_id`,
        [user.id],
      ),
      this.db.query<{ universe_id: string; speed: number; survival: number; wins: number }>(
        `SELECT universe_id,
                COALESCE(max(score) FILTER (WHERE game = 'speed' AND status <> 'active'), 0)::int AS speed,
                COALESCE(max(score) FILTER (WHERE game = 'survival' AND status <> 'active'), 0)::int AS survival,
                count(*) FILTER (WHERE game = 'hangman' AND status = 'won')::int AS wins
           FROM game_sessions WHERE user_id = $1 GROUP BY universe_id`,
        [user.id],
      ),
      this.db.query<{ universe_id: string; day: string }>(
        "SELECT universe_id, day::text AS day FROM game_sessions WHERE user_id = $1 AND game = 'daily' ORDER BY day DESC LIMIT 2000",
        [user.id],
      ),
    ]);

    const days = new Map(byDay.rows.map((r) => [r.day, r]));
    const xpByDay: PlayerStats['xpByDay'] = [];
    for (let i = PERIOD_DAYS - 1; i >= 0; i--) {
      const day = new Date(Date.parse(`${today}T00:00:00Z`) - i * 86_400_000).toISOString().slice(0, 10);
      const r = days.get(day);
      xpByDay.push({ day, xp: Math.max(0, r?.xp ?? 0), bonus: Math.max(0, r?.bonus ?? 0) });
    }
    const ratio = (correct: number, asked: number) => (asked > 0 ? Math.round((correct / asked) * 1000) / 1000 : null);
    const shields = PREMIUM_PERKS.streakShieldsPerWeek[prof?.plan ?? 'free'];
    return {
      periodDays: PERIOD_DAYS,
      xpByDay,
      xpBySource: bySource.rows,
      totals: {
        xpPeriod: xpByDay.reduce((a, d) => a + d.xp + d.bonus, 0),
        bonusPeriod: xpByDay.reduce((a, d) => a + d.bonus, 0),
        activeDays: xpByDay.filter((d) => d.xp + d.bonus > 0).length,
        quizzesCompleted: quiz?.completed ?? 0,
        perfectQuizzes: quiz?.perfect ?? 0,
        accuracy: ratio(quiz?.correct ?? 0, quiz?.asked ?? 0),
        gamesPlayed: games?.n ?? 0,
        missionsCompleted: missions?.n ?? 0,
      },
      universes: universes.rows.map((u) => {
        const q = perUniverseQuiz.rows.find((r) => r.universe_id === u.id);
        const g = perUniverseGames.rows.find((r) => r.universe_id === u.id);
        return {
          slug: u.slug,
          name: u.name,
          xp: u.xp,
          level: levelFromXp(u.xp),
          accuracy: q ? ratio(q.correct, q.asked) : null,
          quizzesCompleted: q?.completed ?? 0,
          dailyStreak: streakInfo(dailyDays.rows.filter((r) => r.universe_id === u.id).map((r) => r.day), today, shields).streak,
          speedBest: g?.speed ?? 0,
          survivalBest: g?.survival ?? 0,
          hangmanWins: g?.wins ?? 0,
        };
      }),
    };
  }
}
