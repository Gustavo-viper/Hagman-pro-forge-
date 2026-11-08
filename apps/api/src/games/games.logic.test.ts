import { describe, expect, it } from 'vitest';
import { baseLetter, dailyStreak, hangmanMask, hangmanWrong, streakInfo } from './games.service.js';

describe('hangman rules', () => {
  it('matches letters without accents or case', () => {
    expect(baseLetter('ö')).toBe('O');
    expect(baseLetter('É')).toBe('E');
    expect(baseLetter('ç')).toBe('C');
    expect(hangmanMask('Mjölnir', ['O'])).toEqual([null, null, 'ö', null, null, null, null]);
    expect(hangmanMask('Padmé Amidala', ['E', 'A'])).toEqual([null, 'a', null, null, 'é', ' ', 'A', null, null, null, 'a', null, 'a']);
  });
  it('shows punctuation, digits and spaces from the start', () => {
    expect(hangmanMask("R2-D2 O'Malley", [])).toEqual([null, '2', '-', null, '2', ' ', null, "'", null, null, null, null, null, null]);
  });
  it('lists wrong guesses only', () => {
    expect(hangmanWrong('Castiel', ['C', 'Z', 'E', 'Q'])).toEqual(['Z', 'Q']);
  });
});

describe('daily streak', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(dailyStreak([], '2026-11-07')).toBe(0);
    expect(dailyStreak(['2026-11-07'], '2026-11-07')).toBe(1);
    expect(dailyStreak(['2026-11-06', '2026-11-05'], '2026-11-07')).toBe(2);
    expect(dailyStreak(['2026-11-07', '2026-11-06', '2026-11-04'], '2026-11-07')).toBe(2);
    expect(dailyStreak(['2026-11-01', '2026-10-31', '2026-10-30'], '2026-11-01')).toBe(3);
    expect(dailyStreak(['2026-11-05'], '2026-11-07')).toBe(0);
  });
});

describe('streak shields (subscribers)', () => {
  const days = ['2026-11-07', '2026-11-06', '2026-11-04', '2026-11-03', '2026-11-01'];
  it('covers missed days within the weekly budget', () => {
    expect(streakInfo(days, '2026-11-07', 0)).toEqual({ streak: 2, covered: [] });
    // One shield: covers the 5th, then the 2nd is also within 7 days of it → stops there.
    expect(streakInfo(days, '2026-11-07', 1)).toEqual({ streak: 4, covered: ['2026-11-05'] });
    expect(streakInfo(days, '2026-11-07', 2)).toEqual({ streak: 5, covered: ['2026-11-05', '2026-11-02'] });
  });
  it('never covers days before the first play or when nothing was played', () => {
    expect(streakInfo(['2026-11-07'], '2026-11-07', 2)).toEqual({ streak: 1, covered: [] });
    expect(streakInfo([], '2026-11-07', 2)).toEqual({ streak: 0, covered: [] });
    // Today not played yet: the streak continues from yesterday.
    expect(streakInfo(['2026-11-06', '2026-11-04'], '2026-11-07', 1)).toEqual({ streak: 2, covered: ['2026-11-05'] });
  });
});
