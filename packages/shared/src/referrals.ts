/**
 * Invite-a-friend program. A referral counts once the invited friend verified the email and
 * joined at least one universe. The number of qualified referrals unlocks a discount on paid
 * plans, applied by the API at checkout (never trusted from the browser).
 */
export interface ReferralTier {
  /** Qualified referrals needed. */
  min: number;
  /** Discount on paid plans, in percent. */
  percent: number;
}

export const REFERRAL_TIERS: readonly ReferralTier[] = [
  { min: 3, percent: 5 },
  { min: 5, percent: 10 },
  { min: 10, percent: 20 },
  { min: 20, percent: 30 },
];

export const REFERRAL_MAX_PERCENT = REFERRAL_TIERS[REFERRAL_TIERS.length - 1]!.percent;

/** Discount (percent) unlocked by a number of qualified referrals. */
export function referralDiscountPercent(qualified: number): number {
  let percent = 0;
  for (const tier of REFERRAL_TIERS) if (qualified >= tier.min) percent = tier.percent;
  return percent;
}

/** Next tier still to unlock, or null at the top tier. */
export function nextReferralTier(qualified: number): ReferralTier | null {
  return REFERRAL_TIERS.find((t) => qualified < t.min) ?? null;
}

/** Price after a percentage discount, rounded to the cent (never below R$ 1,00 for paid prices). */
export function applyDiscount(amountMinor: number, percent: number): number {
  if (percent <= 0 || amountMinor <= 0) return amountMinor;
  return Math.max(100, Math.round((amountMinor * (100 - percent)) / 100));
}

/** Invite codes: unambiguous uppercase letters and digits. */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{6,12}$/;
