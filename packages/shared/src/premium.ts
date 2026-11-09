import type { PlanCode } from './constants.js';

/**
 * Fandom Premium perks. Single source of truth for the API (enforcement) and the web app
 * (plan comparison and upsells), so what is advertised is exactly what is delivered.
 */
export const PREMIUM_PERKS = {
  /** Extra XP on quizzes, games and missions, on top of the base reward. */
  xpBonusPercent: { free: 0, plus: 20, ultra: 50, vip: 50 },
  /** Daily XP from speed rounds per universe. */
  speedDailyXpCap: { free: 60, plus: 120, ultra: 200, vip: 200 },
  /** Hangman wins per universe and day that earn XP. */
  hangmanRewardedWins: { free: 5, plus: 10, ultra: 20, vip: 20 },
  /** Survival mode: minimum plan and daily XP per universe. */
  survivalPlan: 'plus',
  survivalDailyXpCap: { free: 0, plus: 100, ultra: 160, vip: 160 },
  /** Missed days per 7 days that do not break the daily challenge streak. */
  streakShieldsPerWeek: { free: 0, plus: 1, ultra: 2, vip: 2 },
  /** Detailed statistics on the dashboard: minimum plan. */
  statsPlan: 'plus',
  /** Prize draws (lucky numbers): minimum plan. */
  drawsPlan: 'vip',
} as const satisfies Record<string, unknown>;

/** Free trial: once per account (never subscribed before), adults with a verified email. */
export const PREMIUM_TRIAL = { plan: 'plus', days: 7 } as const;

/** XP sources that receive the premium bonus. */
export const XP_BONUS_SOURCES = ['quiz', 'game', 'mission'] as const;

/** Bonus XP for a base reward on a plan (rounded down, never negative). */
export function premiumBonus(base: number, plan: PlanCode): number {
  return base > 0 ? Math.floor((base * PREMIUM_PERKS.xpBonusPercent[plan]) / 100) : 0;
}

/** Forum categories reserved to a minimum plan. */
export const PREMIUM_CATEGORIES: Record<string, Exclude<PlanCode, 'free'>> = { vip_lounge: 'plus' };
