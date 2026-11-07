/**
 * Domain constants shared by web, api and worker.
 * Values here MUST match the CHECK constraints in database/migrations.
 */

export const APP_NAME = 'Fandom Universe';
export const APP_SLOGAN = 'ONE PLATFORM. INFINITE UNIVERSES.';
export const COMPANY_NAME = 'Forge Studios Tecnologias em Softwares LTDA.';

export const SUPPORTED_LOCALES = ['pt-BR', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pt-BR';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export const PLAN_CODES = ['free', 'plus', 'ultra'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

/** Higher rank includes every benefit of the lower ranks. */
export const PLAN_RANK: Record<PlanCode, number> = { free: 0, plus: 1, ultra: 2 };

export const BILLING_INTERVALS = ['month', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const SUBSCRIPTION_STATUSES = [
  'pending',
  'active',
  'past_due',
  'cancelled',
  'expired',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Statuses that grant paid benefits. `past_due` keeps benefits only while
 * inside the configurable grace period (enforced by the API/worker).
 * `cancelled` keeps benefits until the end of the already-paid period.
 */
export const BENEFIT_GRANTING_STATUSES: readonly SubscriptionStatus[] = [
  'active',
  'past_due',
  'cancelled',
];

export const STAFF_ROLES = [
  'super_admin',
  'admin',
  'global_moderator',
  'universe_moderator',
  'editor',
  'support',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const UNIVERSE_STATUSES = ['draft', 'active', 'archived'] as const;
export type UniverseStatus = (typeof UNIVERSE_STATUSES)[number];

export const CONSENT_TYPES = ['terms_of_use', 'privacy_policy', 'marketing_email'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Current legal document versions. Bump when the text changes; users re-consent. */
export const LEGAL_VERSIONS: Record<Exclude<ConsentType, 'marketing_email'>, string> = {
  terms_of_use: '2026-11-01',
  privacy_policy: '2026-11-01',
};

/** Minimum age to create an account without guardian involvement (LGPD art. 14 / COPPA reference). */
export const MINIMUM_AGE = 13;
/** Users under this age receive the protected-minor profile defaults. */
export const ADULT_AGE = 18;

export const XP_SOURCES = [
  'quiz',
  'mission',
  'event',
  'community_help',
  'challenge',
  'achievement',
  'admin_adjustment',
  'onboarding',
  'game',
] as const;
export type XpSource = (typeof XP_SOURCES)[number];
