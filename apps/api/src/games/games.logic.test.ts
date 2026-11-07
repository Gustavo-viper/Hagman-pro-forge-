import { describe, expect, it } from 'vitest';
import { baseLetter, dailyStreak, hangmanMask, hangmanWrong } from './games.service.js';

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
