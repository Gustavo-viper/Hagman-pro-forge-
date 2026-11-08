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

export interface BillingConfig {
  /** false until the payment provider credentials are configured on the API. */
  enabled: boolean;
  provider: 'infinitepay' | null;
  currency: string;
  /** InfinitePay has no recurring API: periods are prepaid and renewed manually. */
  autoRenew: boolean;
}

export interface CheckoutResponse {
  checkoutUrl: string;
  orderNsu: string;
  expiresAt: string;
}

export interface PaymentSummary {
  id: string;
  planCode: PlanCode;
  interval: BillingInterval;
  amountMinor: number;
  paidAmountMinor: number | null;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  captureMethod: string | null;
  installments: number | null;
  receiptUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface SubscriptionDetails {
  subscription: SubscriptionSnapshot;
  /** Price of the current/last plan period, if any. */
  currentPrice: { amountMinor: number; currency: string } | null;
  payments: PaymentSummary[];
  /** True when the user may start a checkout now (no blocking condition). */
  canCheckout: boolean;
  /** Plan the user may renew (same plan only while a period is open). */
  renewablePlan: PlanCode | null;
}

export interface ConfirmPaymentResponse {
  status: 'paid' | 'pending';
  subscription: SubscriptionSnapshot;
}

export interface AdminStats {
  users: { total: number; newLast7Days: number; verified: number; suspended: number };
  subscribers: { plus: number; ultra: number };
  revenue: { currency: string; thisMonthMinor: number; last30DaysMinor: number };
  pendingCheckouts: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  emailVerified: boolean;
  status: 'active' | 'suspended' | 'banned' | 'deleted';
  username: string | null;
  displayName: string | null;
  country: string | null;
  isMinor: boolean;
  onboardingCompleted: boolean;
  roles: string[];
  createdAt: string;
  lastSeenAt: string | null;
  plan: SubscriptionSnapshot & { provider: string | null };
}

export interface AdminUserDetails extends AdminUserRow {
  xpTotal: number;
  universes: string[];
  payments: PaymentSummary[];
  history: { at: string; from: string | null; to: string; reason: string; actor: string }[];
  audit: { at: string; action: string; actor: string | null; metadata: Record<string, unknown> }[];
}

export interface QuizSummary {
  id: string;
  slug: string;
  kind: 'trivia' | 'personality';
  title: LocalizedText;
  description: LocalizedText;
  difficulty: 'easy' | 'normal' | 'hard';
  xpReward: number;
  setsIdentity: boolean;
  questionCount: number;
}

export interface QuizQuestionPublic {
  id: string;
  position: number;
  prompt: LocalizedText;
  options: { key: string; text: LocalizedText }[];
}

export interface QuizDetail extends QuizSummary {
  universeSlug: string;
  questions: QuizQuestionPublic[];
}

export interface QuizAttemptResult {
  attemptId: string;
  score: number;
  total: number;
  xpAwarded: number;
  /** Extra XP from the subscriber's plan (already granted, on top of xpAwarded). */
  xpBonus: number;
  /** XP still available from this quiz by improving the score. */
  xpRemaining: number;
  /** Personality quizzes: identity key assigned in the universe. */
  resultIdentity: string | null;
  review: { questionId: string; chosen: string; correctKey: string | null; correct: boolean | null; explanation: LocalizedText | null }[];
}

export interface QuizProgress {
  quizId: string;
  attempts: number;
  bestScore: number;
  total: number;
  xpEarned: number;
}

export interface RankingEntry {
  rank: number;
  userId: string;
  username: string | null;
  displayName: string | null;
  plan: PlanBadge;
  xp: number;
  level: number;
  identity: string | null;
}

export interface LoreEntry {
  id: string;
  slug: string;
  section: string;
  title: LocalizedText;
  subtitle: LocalizedText | null;
  summary: LocalizedText;
  tags: string[];
}

export interface ForumAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  identity: string | null;
  /** Subscriber badge shown next to the name. */
  plan: PlanBadge;
}

/** Plan badge shown next to names ('plus' | 'ultra'), null for Free. */
export type PlanBadge = 'plus' | 'ultra' | null;

export interface ForumTopicSummary {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  author: ForumAuthor;
  replyCount: number;
  identityScope: string | null;
  createdAt: string;
  lastActivityAt: string;
}

export interface ForumReply {
  id: string;
  body: string;
  author: ForumAuthor;
  createdAt: string;
  mine: boolean;
}

export interface ForumTopicDetail extends Omit<ForumTopicSummary, 'excerpt'> {
  universeSlug: string;
  body: string;
  mine: boolean;
  replies: ForumReply[];
}

export interface MissionSummary {
  id: string;
  slug: string;
  section: string;
  title: LocalizedText;
  description: LocalizedText;
  objectiveType: string;
  objectiveCount: number;
  xpReward: number;
  endsAt: string | null;
  /** Only subscribers of this plan (or higher) can claim it. */
  premiumPlan: 'plus' | 'ultra' | null;
}

export interface MissionProgress {
  missionId: string;
  progress: number;
  completed: boolean;
  completedAt: string | null;
}

export interface UniverseEvent {
  id: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  kind: 'community' | 'tournament' | 'watch_party' | 'challenge';
  startsAt: string;
  endsAt: string;
  premiumPlan: 'plus' | 'ultra' | null;
  capacity: number | null;
  participantCount: number;
  hasQuiz: boolean;
  hasExternalLink: boolean;
  status: 'published' | 'cancelled' | 'draft';
}

export interface IdentityStanding {
  identity: string;
  members: number;
  xp: number;
}

export interface AdminReport {
  id: string;
  targetType: 'topic' | 'reply';
  targetId: string;
  reason: string;
  details: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  reporter: string;
  reportsOnTarget: number;
  content: { title: string | null; body: string; author: string; status: string; universeSlug: string; topicId: string } | null;
}

export interface EventMessage {
  id: number;
  body: string;
  createdAt: string;
  author: ForumAuthor;
  mine: boolean;
}

export interface EventLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string | null;
  plan: PlanBadge;
  username: string | null;
  score: number;
  total: number;
  finishedAt: string;
}

export interface EventRoom {
  event: UniverseEvent;
  universeSlug: string;
  /** The room opens 30 min before the start and closes 1 h after the end. */
  opensAt: string;
  closesAt: string;
  open: boolean;
  externalUrl: string | null;
  quiz: { id: string; title: LocalizedText; questionCount: number } | null;
  messages: EventMessage[];
  leaderboard: EventLeaderboardEntry[];
  canModerate: boolean;
}

export interface AdminEvent extends UniverseEvent {
  universeSlug: string;
  externalUrl: string | null;
  quizId: string | null;
}

// ---------------------------------------------------------------- mini-games

export type GameKind = 'daily' | 'speed' | 'hangman' | 'survival';

/** A question as served by a game: never includes the answer. */
export interface GameQuestion {
  id: string;
  prompt: LocalizedText;
  options: { key: string; text: LocalizedText }[];
}

export interface GameReviewItem {
  questionId: string;
  chosen: string;
  correctKey: string;
  correct: boolean;
  explanation: LocalizedText | null;
}

export interface DailyResult {
  score: number;
  total: number;
  xpAwarded: number;
  xpBonus: number;
  finishedAt: string;
  review: GameReviewItem[];
}

export interface DailyChallenge {
  /** Challenge date (America/Sao_Paulo), YYYY-MM-DD. Same questions for everyone that day. */
  day: string;
  questions: GameQuestion[];
  /** Present once the user has played today (questions stay visible for the review). */
  result: DailyResult | null;
  /** Consecutive days played, including today when played. */
  streak: number;
  xpPerCorrect: number;
  perfectBonus: number;
}

export interface SpeedRound {
  id: string;
  status: 'active' | 'finished';
  endsAt: string;
  durationSeconds: number;
  score: number;
  answered: number;
  question: GameQuestion | null;
  xpAwarded: number;
  xpBonus: number;
  /** Present after an answer. */
  last?: { questionId: string; correct: boolean; correctKey: string };
}

/** Survival mode (subscribers): one mistake or a timed-out question ends the run. */
export interface SurvivalRound {
  id: string;
  status: 'active' | 'finished';
  score: number;
  answered: number;
  question: GameQuestion | null;
  questionEndsAt: string;
  questionSeconds: number;
  xpAwarded: number;
  xpBonus: number;
  last?: { questionId: string; correct: boolean; correctKey: string; timedOut: boolean };
}

export interface HangmanGame {
  id: string;
  status: 'active' | 'won' | 'lost';
  /** One entry per character: the character when revealed (or not a letter), null when hidden. */
  mask: (string | null)[];
  hint: LocalizedText;
  guessed: string[];
  wrong: string[];
  livesLeft: number;
  maxLives: number;
  /** Revealed when the game ends. */
  word: string | null;
  xpAwarded: number;
  xpBonus: number;
}

export interface GamesOverview {
  plan: 'free' | 'plus' | 'ultra';
  /** Limits of the user's plan (the web shows what higher plans unlock). */
  limits: { speedDailyXp: number; hangmanRewardedWins: number; survivalDailyXp: number; xpBonusPercent: number };
  survival: { available: boolean; best: number; weekBest: number; xpLeftToday: number };
  daily: { playedToday: boolean; score: number | null; total: number | null; streak: number };
  speed: { best: number; weekBest: number; xpLeftToday: number };
  hangman: { wins: number; played: number; rewardedWinsLeft: number; activeId: string | null };
}

export interface GameLeaderboardEntry {
  rank: number;
  userId: string;
  username: string | null;
  displayName: string | null;
  plan: PlanBadge;
  score: number;
  total: number | null;
}
