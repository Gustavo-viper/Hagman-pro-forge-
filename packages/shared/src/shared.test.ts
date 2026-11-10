import { describe, expect, it } from 'vitest';
import { applyDiscount, nextReferralTier, referralDiscountPercent } from './referrals.js';
import {
  ageFromBirthdate,
  formatMoney,
  levelFromXp,
  levelProgress,
  monthlyEquivalent,
  slugify,
  totalXpForLevel,
  yearlySavingsPercent,
} from './index.js';

describe('gamification', () => {
  it('maps XP thresholds to levels', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(totalXpForLevel(3)).toBe(300);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(299)).toBe(2);
    expect(levelFromXp(300)).toBe(3);
    expect(levelFromXp(-50)).toBe(1);
  });

  it('is consistent for every level boundary', () => {
    for (let n = 1; n < 200; n++) {
      expect(levelFromXp(totalXpForLevel(n))).toBe(n);
      if (n > 1) expect(levelFromXp(totalXpForLevel(n) - 1)).toBe(n - 1);
    }
  });

  it('computes progress inside a level', () => {
    const p = levelProgress(150);
    expect(p.level).toBe(2);
    expect(p.currentLevelXp).toBe(100);
    expect(p.nextLevelXp).toBe(300);
    expect(p.progress).toBeCloseTo(0.25);
  });
});

describe('money', () => {
  it('formats BRL in pt-BR', () => {
    expect(formatMoney(1490, 'BRL', 'pt-BR').replace(/\s/g, ' ')).toBe('R$ 14,90');
  });
  it('formats USD in en', () => {
    expect(formatMoney(499, 'USD', 'en')).toBe('$4.99');
  });
  it('rejects floats', () => {
    expect(() => formatMoney(14.9, 'BRL', 'pt-BR')).toThrow();
  });
  it('computes yearly savings', () => {
    expect(yearlySavingsPercent(1490, 14990)).toBe(16);
    expect(monthlyEquivalent(14990)).toBe(1249);
  });
});

describe('text', () => {
  it('slugifies accented names', () => {
    expect(slugify('  Grifinória & Lufa-Lufa ')).toBe('grifinoria-lufa-lufa');
  });
  it('computes age', () => {
    expect(ageFromBirthdate('2010-11-08', new Date('2026-11-07T12:00:00Z'))).toBe(15);
    expect(ageFromBirthdate('2010-11-07', new Date('2026-11-07T12:00:00Z'))).toBe(16);
  });
});

describe('referral discounts', () => {
  it('unlocks 5/10/20/30% at 3/5/10/20 qualified friends', () => {
    expect([0, 2, 3, 4, 5, 9, 10, 19, 20, 50].map(referralDiscountPercent)).toEqual([0, 0, 5, 5, 10, 10, 20, 20, 30, 30]);
    expect(nextReferralTier(0)).toEqual({ min: 3, percent: 5 });
    expect(nextReferralTier(10)).toEqual({ min: 20, percent: 30 });
    expect(nextReferralTier(20)).toBeNull();
  });
  it('applies the discount to the cent', () => {
    expect(applyDiscount(2990, 0)).toBe(2990);
    expect(applyDiscount(2990, 20)).toBe(2392);
    expect(applyDiscount(7990, 30)).toBe(5593);
    expect(applyDiscount(0, 30)).toBe(0);
  });
});
