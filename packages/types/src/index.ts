/**
 * Response contracts of the Fandom Universe REST API (v1).
 * Request bodies are validated with @fandom/schemas; these types describe what the API returns.
 */
import type {
  BillingInterval,
  Locale,
  PlanCode,
  StaffRole,
  SubscriptionStatus,
  UniverseStatus,
} from '@fandom/shared';

export type LocalizedText = Record<Locale, string>;

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  /** Stable machine-readable code, translated by the web app. */
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

/** Returned by register, login and refresh. The refresh token rotates on every use. */
export interface AuthSessionResponse {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  refreshToken: string;
  /** ISO date when the refresh token expires. */
  refreshExpiresAt: string;
  user: AuthUser;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  uptimeSeconds: number;
  checks?: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }>;
}

export interface UniverseThemeTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  glow: string;
}

export interface UniverseSummary {
  id: string;
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText;
  description: LocalizedText;
  status: UniverseStatus;
  theme: UniverseThemeTokens;
  features: string[];
  memberCount: number;
  sortOrder: number;
}

export interface UniverseMembership {
  universeId: string;
  slug: string;
  joinedAt: string;
  xp: number;
  level: number;
  /** Universe-specific identity, e.g. Hogwarts-style house or hunter rank. */
  identity: Record<string, unknown>;
}

export interface PlanPrice {
  interval: BillingInterval;
  currency: string;
  amountMinor: number;
}

export interface SubscriptionPlanSummary {
  code: PlanCode;
  name: LocalizedText;
  description: LocalizedText;
  benefits: Record<Locale, string[]>;
  prices: PlanPrice[];
  sortOrder: number;
}

export interface SubscriptionSnapshot {
  planCode: PlanCode;
  status: SubscriptionStatus | 'free';
  interval: BillingInterval | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface MeProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  locale: Locale;
  timezone: string;
  country: string | null;
  onboardingCompleted: boolean;
  isMinor: boolean;
  roles: StaffRole[];
  createdAt: string;
}

export interface MeResponse {
  profile: MeProfile;
  subscription: SubscriptionSnapshot;
}

export interface DashboardResponse {
  profile: MeProfile;
  subscription: SubscriptionSnapshot;
  xp: { total: number; level: number; currentLevelXp: number; nextLevelXp: number | null; progress: number };
  memberships: UniverseMembership[];
  universes: UniverseSummary[];
}
