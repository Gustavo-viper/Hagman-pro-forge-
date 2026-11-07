import { Injectable } from '@nestjs/common';
import {
  ADULT_AGE,
  ageFromBirthdate,
  LEGAL_VERSIONS,
  levelProgress,
  MINIMUM_AGE,
  type Locale,
} from '@fandom/shared';
import type { OnboardingInput, UpdatePreferencesInput } from '@fandom/schemas';
import type { DashboardResponse, MeProfile, MeResponse } from '@fandom/types';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { DatabaseService } from '../database/database.service.js';
import { EntitlementsService } from '../subscriptions/entitlements.service.js';
import { UniversesService } from '../universes/universes.service.js';
import { XpService } from '../xp/xp.service.js';

export const ONBOARDING_XP = 50;

/** Restrictive defaults for users under 18 (ECA / LGPD art. 14 — best interest of the minor). */
const MINOR_PRIVACY = { profileVisibility: 'members', allowMessagesFrom: 'friends', showOnlineStatus: false };
const ADULT_PRIVACY = { profileVisibility: 'public', allowMessagesFrom: 'everyone', showOnlineStatus: true };

interface ProfileRow {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  locale: Locale;
  timezone: string;
  country: string | null;
  is_minor: boolean;
  onboarding_completed_at: Date | null;
  xp_total: number;
  created_at: Date;
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

@Injectable()
export class MeService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
    private readonly universes: UniversesService,
    private readonly xp: XpService,
    private readonly audit: AuditService,
  ) {}

  private async loadProfile(user: AuthenticatedUser): Promise<{ profile: MeProfile; xpTotal: number }> {
    const row = await this.db.one<ProfileRow>(
      `SELECT username, display_name, avatar_url, locale, timezone, country, is_minor,
              onboarding_completed_at, xp_total, created_at
         FROM profiles WHERE user_id = $1`,
      [user.id],
    );
    if (!row) throw AppError.notFound('profile_not_found', 'Profile not found');
    return {
      xpTotal: row.xp_total,
      profile: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        locale: row.locale,
        timezone: row.timezone,
        country: row.country,
        onboardingCompleted: row.onboarding_completed_at !== null,
        isMinor: row.is_minor,
        roles: user.roles,
        createdAt: row.created_at.toISOString(),
      },
    };
  }

  async me(user: AuthenticatedUser): Promise<MeResponse> {
    const [{ profile }, subscription] = await Promise.all([this.loadProfile(user), this.entitlements.snapshot(user.id)]);
    return { profile, subscription };
  }

  async dashboard(user: AuthenticatedUser): Promise<DashboardResponse> {
    const [{ profile, xpTotal }, subscription, memberships, universes] = await Promise.all([
      this.loadProfile(user),
      this.entitlements.snapshot(user.id),
      this.universes.memberships(user.id),
      this.universes.listActive(),
    ]);
    const p = levelProgress(xpTotal);
    return {
      profile,
      subscription,
      xp: { total: p.xp, level: p.level, currentLevelXp: p.currentLevelXp, nextLevelXp: p.nextLevelXp, progress: p.progress },
      memberships,
      universes,
    };
  }

  async usernameAvailable(username: string, userId: string): Promise<boolean> {
    const row = await this.db.one('SELECT 1 FROM profiles WHERE username = $1 AND user_id <> $2', [username, userId]);
    return row === null;
  }

  async completeOnboarding(user: AuthenticatedUser, input: OnboardingInput, meta: RequestMeta): Promise<MeResponse> {
    const age = ageFromBirthdate(input.birthdate);
    if (age < MINIMUM_AGE) {
      throw AppError.forbidden('age_restricted', `Users must be at least ${MINIMUM_AGE} years old`);
    }
    if (age > 120) throw new AppError('invalid_birthdate', 'Invalid birthdate', 422);
    const isMinor = age < ADULT_AGE;

    await this.db.transaction(async (tx) => {
      const current = await tx.query<{ onboarding_completed_at: Date | null }>(
        'SELECT onboarding_completed_at FROM profiles WHERE user_id = $1 FOR UPDATE',
        [user.id],
      );
      if (current.rows[0]?.onboarding_completed_at) {
        throw AppError.conflict('onboarding_already_completed', 'Onboarding already completed');
      }
      try {
        await tx.query(
          `UPDATE profiles SET username = $2, display_name = $3, birthdate = $4, country = $5, locale = $6,
                  timezone = $7, is_minor = $8, privacy = $9, onboarding_completed_at = now()
            WHERE user_id = $1`,
          [
            user.id, input.username, input.displayName, input.birthdate, input.country, input.locale,
            input.timezone, isMinor, JSON.stringify(isMinor ? MINOR_PRIVACY : ADULT_PRIVACY),
          ],
        );
      } catch (error) {
        if ((error as { code?: string; constraint?: string }).code === '23505') {
          throw AppError.conflict('username_taken', 'Username already taken');
        }
        throw error;
      }

      const consents: [string, string, boolean][] = [
        ['terms_of_use', LEGAL_VERSIONS.terms_of_use, true],
        ['privacy_policy', LEGAL_VERSIONS.privacy_policy, true],
        // Minors never opt into marketing communications.
        ['marketing_email', LEGAL_VERSIONS.privacy_policy, input.marketingEmail && !isMinor],
      ];
      for (const [type, version, granted] of consents) {
        await tx.query(
          `INSERT INTO user_consents (user_id, consent_type, version, granted, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user.id, type, version, granted, meta.ip, meta.userAgent?.slice(0, 512) ?? null],
        );
      }

      await this.xp.award(tx, {
        userId: user.id,
        amount: ONBOARDING_XP,
        source: 'onboarding',
        idempotencyKey: `onboarding:${user.id}`,
      });
      await this.audit.log(tx, {
        actorUserId: user.id,
        action: 'user.onboarding_completed',
        targetType: 'user',
        targetId: user.id,
        metadata: { isMinor, country: input.country, locale: input.locale },
        ipAddress: meta.ip,
        requestId: meta.requestId,
      });
    });
    return this.me(user);
  }

  async updatePreferences(user: AuthenticatedUser, input: UpdatePreferencesInput): Promise<MeResponse> {
    await this.db.query(
      'UPDATE profiles SET locale = COALESCE($2, locale), timezone = COALESCE($3, timezone) WHERE user_id = $1',
      [user.id, input.locale ?? null, input.timezone ?? null],
    );
    return this.me(user);
  }
}
