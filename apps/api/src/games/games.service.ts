import { randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { DailySubmitInput, GameLeaderboardQuery, SpeedAnswerInput } from '@fandom/schemas';
import type {
  DailyChallenge,
  DailyResult,
  GameLeaderboardEntry,
  GameQuestion,
  GameReviewItem,
  GamesOverview,
  HangmanGame,
  LocalizedText,
  SpeedRound,
} from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { DatabaseService, type Queryable } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { UniversesService } from '../universes/universes.service.js';
import { XpService } from '../xp/xp.service.js';

export const GAME_TZ = 'America/Sao_Paulo';
export const DAILY_SIZE = 5;
export const DAILY_XP_PER_CORRECT = 8;
export const DAILY_PERFECT_BONUS = 10;
export const SPEED_SECONDS = 60;
const SPEED_GRACE_MS = 3_000;
export const SPEED_XP_PER_CORRECT = 3;
export const SPEED_DAILY_XP_CAP = 60;
const SPEED_MAX_QUESTIONS = 60;
export const HANGMAN_LIVES = 6;
export const HANGMAN_WIN_XP = 15;
export const HANGMAN_REWARDED_WINS_PER_DAY = 5;
const HANGMAN_AVOID_RECENT = 15;

/** Start of "today" in the games timezone, as a SQL expression. */
const TODAY_START = `(date_trunc('day', now() AT TIME ZONE '${GAME_TZ}') AT TIME ZONE '${GAME_TZ}')`;

interface PoolQuestion {
  id: string;
  prompt: LocalizedText;
  options: { key: string; text: LocalizedText }[];
  correct_key: string;
  explanation: LocalizedText | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  universe_id: string;
  game: 'daily' | 'speed' | 'hangman';
  status: 'active' | 'won' | 'lost' | 'finished';
  state: Record<string, unknown>;
  score: number;
  total: number;
  xp_awarded: number;
  started_at: Date;
  finished_at: Date | null;
}

interface SpeedState { order: string[]; index: number; deadline: string; last?: SpeedRound['last'] }
interface HangmanState { wordId: string; word: string; hint: LocalizedText; guessed: string[] }

const publicQuestion = (q: PoolQuestion): GameQuestion => ({
  id: q.id,
  prompt: q.prompt,
  options: q.options.map((o) => ({ key: o.key, text: o.text })),
});

/** "Ã" → "A", "ö" → "O": letters are matched without accents and case. */
export function baseLetter(ch: string): string {
  return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}
const isLetter = (ch: string) => /^[A-Z]$/.test(baseLetter(ch));

export function hangmanMask(word: string, guessed: Iterable<string>): (string | null)[] {
  const g = new Set(guessed);
  return [...word].map((ch) => (!isLetter(ch) || g.has(baseLetter(ch)) ? ch : null));
}

export function hangmanWrong(word: string, guessed: string[]): string[] {
  const letters = new Set([...word].filter(isLetter).map(baseLetter));
  return guessed.filter((l) => !letters.has(l));
}

/** Consecutive days ending today (or yesterday when today is not played yet). Days are YYYY-MM-DD. */
export function dailyStreak(days: string[], today: string): number {
  const set = new Set(days);
  const step = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  let cursor = set.has(today) ? today : step(today);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = step(cursor);
  }
  return n;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

@Injectable()
export class GamesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly xp: XpService,
    private readonly universes: UniversesService,
  ) {}

  // ---------------------------------------------------------------- helpers

  private async memberUniverse(user: AuthenticatedUser, slug: string): Promise<{ id: string }> {
    const universe = await this.universes.getActive(slug);
    const m = await this.db.one('SELECT 1 FROM universe_members WHERE universe_id = $1 AND user_id = $2', [universe.id, user.id]);
    if (!m) throw AppError.forbidden('membership_required', 'Join this universe first');
    return universe;
  }

  private async today(db: Queryable = this.db.pool): Promise<string> {
    const { rows } = await db.query<{ day: string }>(`SELECT (now() AT TIME ZONE '${GAME_TZ}')::date::text AS day`);
    return rows[0]!.day;
  }

  /** Trivia questions of every published trivia quiz in the universe. */
  private async pool(universeId: string, ids?: string[]): Promise<PoolQuestion[]> {
    const { rows } = await this.db.query<PoolQuestion>(
      `SELECT x.id, x.prompt, x.options, x.correct_key, x.explanation
         FROM questions x JOIN quizzes q ON q.id = x.quiz_id
        WHERE q.universe_id = $1 AND q.kind = 'trivia' AND q.status = 'published' AND x.correct_key IS NOT NULL
          ${ids ? 'AND x.id = ANY($2::uuid[])' : ''}`,
      ids ? [universeId, ids] : [universeId],
    );
    return rows;
  }

  private async invalidateRankings(universeId: string): Promise<void> {
    await this.redis.invalidate(
      ...['all', 'month', 'week'].map((p) => `ranking:v1:${universeId}:${p}`),
      ...['daily', 'speed', 'hangman'].map((g) => `games:board:v1:${universeId}:${g}`),
    );
  }

  private async lockSession(tx: Queryable, user: AuthenticatedUser, id: string, game: SessionRow['game']): Promise<SessionRow> {
    const { rows } = await tx.query<SessionRow>('SELECT * FROM game_sessions WHERE id = $1 AND user_id = $2 AND game = $3 FOR UPDATE', [id, user.id, game]);
    if (!rows[0]) throw AppError.notFound('game_not_found', 'Game not found');
    return rows[0];
  }

  // ---------------------------------------------------------------- daily challenge

  /** Today's questions: the same for everyone, picked deterministically from the trivia pool. */
  private async dailyQuestions(universeId: string, day: string): Promise<PoolQuestion[]> {
    const { rows } = await this.db.query<PoolQuestion>(
      `SELECT x.id, x.prompt, x.options, x.correct_key, x.explanation
         FROM questions x JOIN quizzes q ON q.id = x.quiz_id
        WHERE q.universe_id = $1 AND q.kind = 'trivia' AND q.status = 'published' AND x.correct_key IS NOT NULL
        ORDER BY md5(x.id::text || $2) LIMIT ${DAILY_SIZE}`,
      [universeId, day],
    );
    return rows;
  }

  private review(questions: PoolQuestion[], answers: Record<string, string>): GameReviewItem[] {
    return questions.map((q) => ({
      questionId: q.id,
      chosen: answers[q.id] ?? '',
      correctKey: q.correct_key,
      correct: answers[q.id] === q.correct_key,
      explanation: q.explanation,
    }));
  }

  private async streak(userId: string, universeId: string, today: string): Promise<number> {
    const { rows } = await this.db.query<{ day: string }>(
      "SELECT day::text AS day FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'daily' ORDER BY day DESC LIMIT 400",
      [userId, universeId],
    );
    return dailyStreak(rows.map((r) => r.day), today);
  }

  async daily(user: AuthenticatedUser, slug: string): Promise<DailyChallenge> {
    const universe = await this.universes.getActive(slug);
    const day = await this.today();
    const played = await this.db.one<SessionRow>(
      "SELECT * FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'daily' AND day = $3",
      [user.id, universe.id, day],
    );
    let questions: PoolQuestion[];
    let result: DailyResult | null = null;
    if (played) {
      // Review exactly what was asked, in the order it was asked (the pool may have changed since).
      const answers = (played.state.answers ?? {}) as Record<string, string>;
      const order = (played.state.order ?? Object.keys(answers)) as string[];
      questions = (await this.pool(universe.id, order)).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      result = { score: played.score, total: played.total, xpAwarded: played.xp_awarded, finishedAt: played.finished_at!.toISOString(), review: this.review(questions, answers) };
    } else {
      questions = await this.dailyQuestions(universe.id, day);
    }
    return {
      day,
      questions: questions.map(publicQuestion),
      result,
      streak: await this.streak(user.id, universe.id, day),
      xpPerCorrect: DAILY_XP_PER_CORRECT,
      perfectBonus: DAILY_PERFECT_BONUS,
    };
  }

  async submitDaily(user: AuthenticatedUser, slug: string, input: DailySubmitInput): Promise<DailyChallenge> {
    const universe = await this.memberUniverse(user, slug);
    const day = await this.today();
    const questions = await this.dailyQuestions(universe.id, day);
    if (questions.length === 0) throw AppError.notFound('no_questions', 'No questions in this universe yet');
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
    const score = questions.filter((q) => answers[q.id] === q.correct_key).length;
    const total = questions.length;
    const xp = score * DAILY_XP_PER_CORRECT + (score === total ? DAILY_PERFECT_BONUS : 0);

    await this.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO game_sessions (user_id, universe_id, game, status, state, score, total, xp_awarded, day, finished_at)
         VALUES ($1, $2, 'daily', 'finished', $3, $4, $5, $6, $7, now())
         ON CONFLICT (user_id, universe_id, day) WHERE game = 'daily' DO NOTHING
         RETURNING id`,
        [user.id, universe.id, JSON.stringify({ answers, order: questions.map((q) => q.id) }), score, total, xp, day],
      );
      if (!rows[0]) throw AppError.conflict('daily_already_played', 'You already played today\'s challenge');
      if (xp > 0) {
        await this.xp.award(tx, { userId: user.id, universeId: universe.id, amount: xp, source: 'game', sourceRef: `daily:${day}`, idempotencyKey: `game:daily:${rows[0].id}` });
      }
    });
    await this.invalidateRankings(universe.id);
    return this.daily(user, slug);
  }

  // ---------------------------------------------------------------- speed round

  private async speedView(s: SessionRow): Promise<SpeedRound> {
    const st = s.state as unknown as SpeedState;
    const currentId = s.status === 'active' ? st.order[st.index] : undefined;
    const question = currentId ? (await this.pool(s.universe_id, [currentId]))[0] : undefined;
    return {
      id: s.id,
      status: s.status === 'active' ? 'active' : 'finished',
      endsAt: st.deadline,
      durationSeconds: SPEED_SECONDS,
      score: s.score,
      answered: st.index,
      question: question ? publicQuestion(question) : null,
      xpAwarded: s.xp_awarded,
      ...(st.last ? { last: st.last } : {}),
    };
  }

  /** Closes a speed round once and grants XP within the daily cap. */
  private async finishSpeed(tx: Queryable, s: SessionRow): Promise<SessionRow> {
    if (s.status !== 'active') return s;
    const today = await tx.query<{ xp: number }>(
      `SELECT COALESCE(sum(xp_awarded), 0)::int AS xp FROM game_sessions
        WHERE user_id = $1 AND universe_id = $2 AND game = 'speed' AND status <> 'active' AND finished_at >= ${TODAY_START}`,
      [s.user_id, s.universe_id],
    );
    const xp = Math.max(0, Math.min(s.score * SPEED_XP_PER_CORRECT, SPEED_DAILY_XP_CAP - today.rows[0]!.xp));
    const { rows } = await tx.query<SessionRow>(
      "UPDATE game_sessions SET status = 'finished', finished_at = now(), xp_awarded = $2 WHERE id = $1 AND status = 'active' RETURNING *",
      [s.id, xp],
    );
    if (rows[0] && xp > 0) {
      await this.xp.award(tx, { userId: s.user_id, universeId: s.universe_id, amount: xp, source: 'game', sourceRef: 'speed', idempotencyKey: `game:speed:${s.id}` });
    }
    return rows[0] ?? s;
  }

  async startSpeed(user: AuthenticatedUser, slug: string): Promise<SpeedRound> {
    const universe = await this.memberUniverse(user, slug);
    const pool = await this.pool(universe.id);
    if (pool.length === 0) throw AppError.notFound('no_questions', 'No questions in this universe yet');
    const order = shuffle(pool.map((q) => q.id)).slice(0, SPEED_MAX_QUESTIONS);
    const session = await this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`speed:${user.id}:${universe.id}`]);
      // Starting a new round closes any previous one (its score counts as it stands).
      const open = await tx.query<SessionRow>("SELECT * FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'speed' AND status = 'active' FOR UPDATE", [user.id, universe.id]);
      for (const s of open.rows) await this.finishSpeed(tx, s);
      const deadline = new Date(Date.now() + SPEED_SECONDS * 1000).toISOString();
      const { rows } = await tx.query<SessionRow>(
        "INSERT INTO game_sessions (user_id, universe_id, game, state, total) VALUES ($1, $2, 'speed', $3, $4) RETURNING *",
        [user.id, universe.id, JSON.stringify({ order, index: 0, deadline } satisfies SpeedState), order.length],
      );
      return rows[0]!;
    });
    await this.invalidateRankings(universe.id);
    return this.speedView(session);
  }

  async answerSpeed(user: AuthenticatedUser, id: string, input: SpeedAnswerInput): Promise<SpeedRound> {
    const session = await this.db.transaction(async (tx) => {
      const s = await this.lockSession(tx, user, id, 'speed');
      if (s.status !== 'active') throw AppError.conflict('game_finished', 'This round is over');
      const st = s.state as unknown as SpeedState;
      if (Date.now() > Date.parse(st.deadline) + SPEED_GRACE_MS) return this.finishSpeed(tx, s); // time is up: no grading
      if (st.order[st.index] !== input.questionId) throw AppError.conflict('wrong_question', 'Answer the current question');
      const q = (await this.pool(s.universe_id, [input.questionId]))[0];
      if (!q) throw AppError.notFound('quiz_not_found', 'Question not found');
      if (!q.options.some((o) => o.key === input.key)) throw new AppError('incomplete_answers', 'Invalid option', HttpStatus.UNPROCESSABLE_ENTITY);
      const correct = q.correct_key === input.key;
      const next: SpeedState = { ...st, index: st.index + 1, last: { questionId: q.id, correct, correctKey: q.correct_key } };
      const { rows } = await tx.query<SessionRow>(
        'UPDATE game_sessions SET state = $2, score = score + $3 WHERE id = $1 RETURNING *',
        [s.id, JSON.stringify(next), correct ? 1 : 0],
      );
      return next.index >= st.order.length ? this.finishSpeed(tx, rows[0]!) : rows[0]!;
    });
    if (session.status !== 'active') await this.invalidateRankings(session.universe_id);
    return this.speedView(session);
  }

  /** Ends the round (timer ran out on the client, or the player gave up). */
  async finishSpeedRound(user: AuthenticatedUser, id: string): Promise<SpeedRound> {
    const session = await this.db.transaction(async (tx) => this.finishSpeed(tx, await this.lockSession(tx, user, id, 'speed')));
    await this.invalidateRankings(session.universe_id);
    return this.speedView(session);
  }

  // ---------------------------------------------------------------- hangman

  private hangmanView(s: SessionRow): HangmanGame {
    const st = s.state as unknown as HangmanState;
    const wrong = hangmanWrong(st.word, st.guessed);
    const done = s.status !== 'active';
    return {
      id: s.id,
      status: s.status === 'won' ? 'won' : s.status === 'active' ? 'active' : 'lost',
      mask: done ? [...st.word] : hangmanMask(st.word, st.guessed),
      hint: st.hint,
      guessed: st.guessed,
      wrong,
      livesLeft: Math.max(0, HANGMAN_LIVES - wrong.length),
      maxLives: HANGMAN_LIVES,
      word: done ? st.word : null,
      xpAwarded: s.xp_awarded,
    };
  }

  async startHangman(user: AuthenticatedUser, slug: string): Promise<HangmanGame> {
    const universe = await this.memberUniverse(user, slug);
    const session = await this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hangman:${user.id}:${universe.id}`]);
      // A new game abandons the previous one (counts as a loss).
      await tx.query(
        "UPDATE game_sessions SET status = 'lost', finished_at = now() WHERE user_id = $1 AND universe_id = $2 AND game = 'hangman' AND status = 'active'",
        [user.id, universe.id],
      );
      const recent = await tx.query<{ word_id: string }>(
        `SELECT state->>'wordId' AS word_id FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'hangman'
          ORDER BY started_at DESC LIMIT ${HANGMAN_AVOID_RECENT}`,
        [user.id, universe.id],
      );
      const avoid = recent.rows.map((r) => r.word_id).filter(Boolean);
      const pick = async (exclude: string[]) =>
        (await tx.query<{ id: string; word: string; hint: LocalizedText }>(
          `SELECT id, word, hint FROM game_words WHERE universe_id = $1 AND status = 'published' AND NOT (id = ANY($2::uuid[])) ORDER BY random() LIMIT 1`,
          [universe.id, exclude],
        )).rows[0];
      const word = (await pick(avoid)) ?? (await pick([]));
      if (!word) throw AppError.notFound('no_words', 'No words in this universe yet');
      const { rows } = await tx.query<SessionRow>(
        "INSERT INTO game_sessions (user_id, universe_id, game, state, total) VALUES ($1, $2, 'hangman', $3, $4) RETURNING *",
        [user.id, universe.id, JSON.stringify({ wordId: word.id, word: word.word, hint: word.hint, guessed: [] } satisfies HangmanState), HANGMAN_LIVES],
      );
      return rows[0]!;
    });
    return this.hangmanView(session);
  }

  async hangman(user: AuthenticatedUser, id: string): Promise<HangmanGame> {
    const s = await this.db.one<SessionRow>("SELECT * FROM game_sessions WHERE id = $1 AND user_id = $2 AND game = 'hangman'", [id, user.id]);
    if (!s) throw AppError.notFound('game_not_found', 'Game not found');
    return this.hangmanView(s);
  }

  async guess(user: AuthenticatedUser, id: string, letter: string): Promise<HangmanGame> {
    const session = await this.db.transaction(async (tx) => {
      const s = await this.lockSession(tx, user, id, 'hangman');
      if (s.status !== 'active') throw AppError.conflict('game_finished', 'This game is over');
      const st = s.state as unknown as HangmanState;
      if (st.guessed.includes(letter)) return s; // idempotent: repeating a letter costs nothing
      const guessed = [...st.guessed, letter];
      const won = !hangmanMask(st.word, guessed).includes(null);
      const lost = !won && hangmanWrong(st.word, guessed).length >= HANGMAN_LIVES;
      let xp = 0;
      if (won) {
        const today = await tx.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'hangman'
              AND status = 'won' AND xp_awarded > 0 AND finished_at >= ${TODAY_START}`,
          [s.user_id, s.universe_id],
        );
        xp = today.rows[0]!.n < HANGMAN_REWARDED_WINS_PER_DAY ? HANGMAN_WIN_XP : 0;
      }
      const { rows } = await tx.query<SessionRow>(
        `UPDATE game_sessions SET state = $2, status = $3, score = $4, xp_awarded = $5,
                finished_at = CASE WHEN $3 = 'active' THEN NULL ELSE now() END
          WHERE id = $1 RETURNING *`,
        [s.id, JSON.stringify({ ...st, guessed }), won ? 'won' : lost ? 'lost' : 'active', won ? 1 : 0, xp],
      );
      if (xp > 0) {
        await this.xp.award(tx, { userId: s.user_id, universeId: s.universe_id, amount: xp, source: 'game', sourceRef: 'hangman', idempotencyKey: `game:hangman:${s.id}` });
      }
      return rows[0]!;
    });
    if (session.status !== 'active') await this.invalidateRankings(session.universe_id);
    return this.hangmanView(session);
  }

  // ---------------------------------------------------------------- overview & leaderboards

  async overview(user: AuthenticatedUser, slug: string): Promise<GamesOverview> {
    const universe = await this.universes.getActive(slug);
    const day = await this.today();
    const args = [user.id, universe.id];
    const [daily, speed, hangman] = await Promise.all([
      this.db.one<{ score: number; total: number }>("SELECT score, total FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'daily' AND day = $3", [...args, day]),
      this.db.one<{ best: number; week: number; today_xp: number }>(
        `SELECT COALESCE(max(score), 0)::int AS best,
                COALESCE(max(score) FILTER (WHERE finished_at > now() - interval '7 days'), 0)::int AS week,
                COALESCE(sum(xp_awarded) FILTER (WHERE finished_at >= ${TODAY_START}), 0)::int AS today_xp
           FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'speed' AND status <> 'active'`,
        args,
      ),
      this.db.one<{ wins: number; played: number; rewarded_today: number; active_id: string | null }>(
        `SELECT count(*) FILTER (WHERE status = 'won')::int AS wins,
                count(*) FILTER (WHERE status <> 'active')::int AS played,
                count(*) FILTER (WHERE status = 'won' AND xp_awarded > 0 AND finished_at >= ${TODAY_START})::int AS rewarded_today,
                (array_agg(id ORDER BY started_at DESC) FILTER (WHERE status = 'active'))[1] AS active_id
           FROM game_sessions WHERE user_id = $1 AND universe_id = $2 AND game = 'hangman'`,
        args,
      ),
    ]);
    return {
      daily: { playedToday: Boolean(daily), score: daily?.score ?? null, total: daily?.total ?? null, streak: await this.streak(user.id, universe.id, day) },
      speed: { best: speed?.best ?? 0, weekBest: speed?.week ?? 0, xpLeftToday: Math.max(0, SPEED_DAILY_XP_CAP - (speed?.today_xp ?? 0)) },
      hangman: {
        wins: hangman?.wins ?? 0,
        played: hangman?.played ?? 0,
        rewardedWinsLeft: Math.max(0, HANGMAN_REWARDED_WINS_PER_DAY - (hangman?.rewarded_today ?? 0)),
        activeId: hangman?.active_id ?? null,
      },
    };
  }

  /** daily: today's results · speed: best round in 7 days · hangman: wins in 7 days. */
  async leaderboard(slug: string, q: GameLeaderboardQuery): Promise<GameLeaderboardEntry[]> {
    const universe = await this.universes.getActive(slug);
    return this.redis.cached(`games:board:v1:${universe.id}:${q.game}`, 15, async () => {
      const people = `JOIN users u ON u.id = s.user_id AND u.status = 'active' JOIN profiles p ON p.user_id = s.user_id`;
      const sql =
        q.game === 'daily'
          ? `SELECT s.user_id, p.username, p.display_name, s.score, s.total FROM game_sessions s ${people}
              WHERE s.universe_id = $1 AND s.game = 'daily' AND s.day = (now() AT TIME ZONE '${GAME_TZ}')::date
              ORDER BY s.score DESC, s.finished_at ASC LIMIT 20`
          : q.game === 'speed'
            ? `SELECT * FROM (
                 SELECT DISTINCT ON (s.user_id) s.user_id, p.username, p.display_name, s.score, NULL::int AS total, s.finished_at FROM game_sessions s ${people}
                  WHERE s.universe_id = $1 AND s.game = 'speed' AND s.status <> 'active' AND s.score > 0 AND s.finished_at > now() - interval '7 days'
                  ORDER BY s.user_id, s.score DESC, s.finished_at ASC) b
               ORDER BY score DESC, finished_at ASC LIMIT 20`
            : `SELECT s.user_id, p.username, p.display_name, count(*)::int AS score, NULL::int AS total FROM game_sessions s ${people}
                WHERE s.universe_id = $1 AND s.game = 'hangman' AND s.status = 'won' AND s.finished_at > now() - interval '7 days'
                GROUP BY s.user_id, p.username, p.display_name
                ORDER BY score DESC, max(s.finished_at) ASC LIMIT 20`;
      const { rows } = await this.db.query<{ user_id: string; username: string | null; display_name: string | null; score: number; total: number | null }>(sql, [universe.id]);
      return rows.map((r, i) => ({ rank: i + 1, userId: r.user_id, username: r.username, displayName: r.display_name, score: r.score, total: r.total }));
    });
  }
}
