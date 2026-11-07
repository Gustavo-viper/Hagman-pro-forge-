/**
 * Level curve: XP required to REACH level n (n >= 1) is
 *   total(n) = 50 * (n - 1) * n
 * Level 1 = 0 XP, level 2 = 100 XP, level 3 = 300 XP, level 4 = 600 XP ...
 * Each level costs 100 XP more than the previous one.
 * Authoritative computation lives in the API; this module is shared so the
 * UI renders the same numbers the backend persisted.
 */

export const MAX_LEVEL = 200;

export function totalXpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError('level must be an integer >= 1');
  return 50 * (level - 1) * level;
}

export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  // Solve 50 n^2 - 50 n - xp = 0  ->  n = (1 + sqrt(1 + 4 xp / 50)) / 2
  const level = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2);
  return Math.min(Math.max(level, 1), MAX_LEVEL);
}

export interface LevelProgress {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  /** 0..1 progress inside the current level. */
  progress: number;
}

export function levelProgress(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = levelFromXp(safeXp);
  const currentLevelXp = totalXpForLevel(level);
  if (level >= MAX_LEVEL) {
    return { level, xp: safeXp, currentLevelXp, nextLevelXp: null, progress: 1 };
  }
  const nextLevelXp = totalXpForLevel(level + 1);
  const progress = (safeXp - currentLevelXp) / (nextLevelXp - currentLevelXp);
  return { level, xp: safeXp, currentLevelXp, nextLevelXp, progress };
}
