import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_PATTERN,
  REFERRAL_TIERS,
  nextReferralTier,
  referralDiscountPercent,
} from '@fandom/shared';
import type { AdminReferral, ReferralSummary } from '@fandom/types';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DatabaseService, type Queryable } from '../database/database.service.js';

/**
 * SQL for the status of a referral row `r` joined to the invited user `f`:
 * it counts once the friend verified the email and joined at least one universe.
 */
const STATUS_SQL = `CASE
    WHEN r.revoked_at IS NOT NULL OR f.deleted_at IS NOT NULL OR f.status = 'deleted' THEN 'revoked'
    WHEN f.email_verified AND EXISTS (SELECT 1 FROM universe_members m WHERE m.user_id = f.id) THEN 'qualified'
    ELSE 'pending' END`;

function newCode(): string {
  return Array.from({ length: 8 }, () => REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)]).join('');
}

@Injectable()
export class ReferralsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** The user's invite code, created on first use. */
  async codeOf(userId: string): Promise<string> {
    const existing = await this.db.query<{ code: string }>('SELECT code FROM referral_codes WHERE user_id = $1', [userId]);
    if (existing.rows[0]) return existing.rows[0].code;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { rows } = await this.db.query<{ code: string }>(
        `INSERT INTO referral_codes (user_id, code) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING code`,
        [userId, newCode()],
      );
      if (rows[0]) return rows[0].code;
      // Either a concurrent request created this user's code, or the random code collided.
      const again = await this.db.query<{ code: string }>('SELECT code FROM referral_codes WHERE user_id = $1', [userId]);
      if (again.rows[0]) return again.rows[0].code;
    }
    throw new Error('could not allocate a referral code');
  }

  /** Called inside the registration transaction: links the new account to the inviter. */
  async attach(tx: Queryable, referredId: string, code: string | undefined): Promise<void> {
    if (!code || !REFERRAL_CODE_PATTERN.test(code)) return;
    const owner = await tx.query<{ user_id: string }>(
      `SELECT c.user_id FROM referral_codes c JOIN users u ON u.id = c.user_id
        WHERE c.code = $1 AND u.deleted_at IS NULL AND u.status = 'active'`,
      [code],
    );
    const referrerId = owner.rows[0]?.user_id;
    if (!referrerId || referrerId === referredId) return;
    await tx.query('INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2) ON CONFLICT (referred_id) DO NOTHING', [referrerId, referredId]);
  }

  /** Qualified referrals → discount percent applied at checkout. */
  async discountPercent(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM referrals r JOIN users f ON f.id = r.referred_id
        WHERE r.referrer_id = $1 AND (${STATUS_SQL}) = 'qualified'`,
      [userId],
    );
    return referralDiscountPercent(rows[0]?.n ?? 0);
  }

  async summary(user: AuthenticatedUser): Promise<ReferralSummary> {
    const code = await this.codeOf(user.id);
    const { rows } = await this.db.query<{ id: string; name: string | null; username: string | null; created_at: Date; status: 'pending' | 'qualified' | 'revoked' }>(
      `SELECT r.id, p.display_name AS name, p.username, r.created_at, ${STATUS_SQL} AS status
         FROM referrals r JOIN users f ON f.id = r.referred_id LEFT JOIN profiles p ON p.user_id = f.id
        WHERE r.referrer_id = $1 ORDER BY r.created_at DESC LIMIT 200`,
      [user.id],
    );
    const qualified = rows.filter((r) => r.status === 'qualified').length;
    return {
      code,
      link: `${this.env.APP_PUBLIC_URL.replace(/\/+$/, '')}/convite/${code}`,
      qualified,
      pending: rows.filter((r) => r.status === 'pending').length,
      discountPercent: referralDiscountPercent(qualified),
      nextTier: nextReferralTier(qualified),
      tiers: [...REFERRAL_TIERS],
      // Friends are shown by public name only (never their email).
      friends: rows.map((r) => ({
        id: r.id,
        name: r.name ?? (r.username ? `@${r.username}` : '—'),
        joinedAt: r.created_at.toISOString(),
        status: r.status,
      })),
    };
  }

  // ------------------------------------------------------------------ staff

  async forUser(userId: string): Promise<{ discountPercent: number; items: AdminReferral[] }> {
    const { rows } = await this.db.query<{ id: string; referred_id: string; email: string; name: string | null; created_at: Date; status: AdminReferral['status']; revoked_reason: string | null }>(
      `SELECT r.id, r.referred_id, f.email, p.display_name AS name, r.created_at, r.revoked_reason, ${STATUS_SQL} AS status
         FROM referrals r JOIN users f ON f.id = r.referred_id LEFT JOIN profiles p ON p.user_id = f.id
        WHERE r.referrer_id = $1 ORDER BY r.created_at DESC LIMIT 500`,
      [userId],
    );
    return {
      discountPercent: referralDiscountPercent(rows.filter((r) => r.status === 'qualified').length),
      items: rows.map((r) => ({
        id: r.id,
        referredId: r.referred_id,
        referredEmail: r.email,
        referredName: r.name,
        createdAt: r.created_at.toISOString(),
        status: r.status,
        revokedReason: r.revoked_reason,
      })),
    };
  }

  /** Staff cancels a fraudulent referral (fake/duplicate account); it stops counting at once. */
  async revoke(admin: AuthenticatedUser, referralId: string, reason: string, ip: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ referrer_id: string }>(
        `UPDATE referrals SET revoked_at = now(), revoked_by = $2, revoked_reason = $3
          WHERE id = $1 AND revoked_at IS NULL RETURNING referrer_id`,
        [referralId, admin.id, reason],
      );
      if (!rows[0]) throw AppError.notFound('referral_not_found', 'Referral not found or already revoked');
      await this.audit.log(tx, {
        actorUserId: admin.id, action: 'admin.referral_revoked', targetType: 'user', targetId: rows[0].referrer_id, ipAddress: ip,
        metadata: { referralId, reason },
      });
    });
  }
}
