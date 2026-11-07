import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { BillingInterval, Locale, PlanCode, SubscriptionStatus } from '@fandom/shared';
import type { AdminUserListInput, GrantPlanInput } from '@fandom/schemas';
import type { AdminReport, AdminStats, AdminUserDetails, AdminUserRow, CursorPage } from '@fandom/types';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { UsersService } from '../auth/users.service.js';
import { PAYMENT_COLUMNS, toPaymentSummary } from '../billing/payments.mapper.js';
import { AppError } from '../common/app-error.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { MailService } from '../mail/mail.service.js';

const PLAN_NAMES: Record<string, string> = { plus: 'Fandom Plus', ultra: 'Fandom Ultra' };

/**
 * Effective plan in SQL. MUST mirror `entitledPlan` in subscriptions/entitlements.service.ts
 * (kept in sync by tests that compare both for the same rows).
 */
const EFFECTIVE_PLAN = `CASE
  WHEN s.id IS NULL THEN 'free'
  WHEN s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now()) THEN s.plan_code
  WHEN s.status = 'past_due' AND s.grace_until > now() THEN s.plan_code
  WHEN s.status = 'cancelled' AND s.current_period_end > now() THEN s.plan_code
  ELSE 'free' END`;

const USER_SELECT = `
  SELECT u.id, u.email, u.email_verified, u.status, u.created_at, u.last_seen_at,
         p.username, p.display_name, p.country, p.is_minor, p.onboarding_completed_at IS NOT NULL AS onboarding_completed,
         p.xp_total,
         COALESCE((SELECT array_agg(DISTINCT r.role) FROM user_roles r WHERE r.user_id = u.id), '{}') AS roles,
         s.id AS sub_id, s.status AS sub_status, s.provider AS sub_provider, s.current_period_end, s.cancel_at_period_end,
         pp.billing_interval, ${EFFECTIVE_PLAN} AS effective_plan
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT * FROM subscriptions s0
       WHERE s0.user_id = u.id AND s0.status IN ('pending','active','past_due','cancelled')
       LIMIT 1
    ) s ON true
    LEFT JOIN plan_prices pp ON pp.id = s.price_id`;

interface UserRow {
  id: string; email: string; email_verified: boolean; status: AdminUserRow['status']; created_at: Date; last_seen_at: Date | null;
  username: string | null; display_name: string | null; country: string | null; is_minor: boolean; onboarding_completed: boolean;
  xp_total: number; roles: string[]; sub_id: string | null; sub_status: SubscriptionStatus | null; sub_provider: string | null;
  current_period_end: Date | null; cancel_at_period_end: boolean | null; billing_interval: BillingInterval | null; effective_plan: PlanCode;
}

const toRow = (r: UserRow): AdminUserRow => ({
  id: r.id,
  email: r.email,
  emailVerified: r.email_verified,
  status: r.status,
  username: r.username,
  displayName: r.display_name,
  country: r.country,
  isMinor: r.is_minor,
  onboardingCompleted: r.onboarding_completed,
  roles: r.roles,
  createdAt: r.created_at.toISOString(),
  lastSeenAt: r.last_seen_at?.toISOString() ?? null,
  plan: {
    planCode: r.effective_plan,
    status: r.sub_status ?? 'free',
    interval: r.sub_provider === 'manual' ? null : r.billing_interval,
    currentPeriodEnd: r.current_period_end?.toISOString() ?? null,
    cancelAtPeriodEnd: r.cancel_at_period_end ?? false,
    provider: r.sub_provider,
  },
});

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async stats(): Promise<AdminStats> {
    const u = await this.db.one<{ total: number; new7: number; verified: number; suspended: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new7,
              count(*) FILTER (WHERE email_verified)::int AS verified,
              count(*) FILTER (WHERE status IN ('suspended','banned'))::int AS suspended
         FROM users WHERE deleted_at IS NULL`,
    );
    const subs = await this.db.query<{ plan: string; n: number }>(
      `SELECT ${EFFECTIVE_PLAN} AS plan, count(*)::int AS n FROM subscriptions s
        WHERE s.status IN ('active','past_due','cancelled') GROUP BY 1`,
    );
    const rev = await this.db.one<{ month: number; d30: number; pending: number }>(
      `SELECT COALESCE(sum(amount_minor) FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('month', now())), 0)::int AS month,
              COALESCE(sum(amount_minor) FILTER (WHERE status = 'paid' AND paid_at > now() - interval '30 days'), 0)::int AS d30,
              count(*) FILTER (WHERE status = 'pending' AND checkout_expires_at > now())::int AS pending
         FROM payment_transactions WHERE currency = 'BRL'`,
    );
    const by = Object.fromEntries(subs.rows.map((r) => [r.plan, r.n]));
    return {
      users: { total: u!.total, newLast7Days: u!.new7, verified: u!.verified, suspended: u!.suspended },
      subscribers: { plus: by.plus ?? 0, ultra: by.ultra ?? 0 },
      revenue: { currency: 'BRL', thisMonthMinor: rev!.month, last30DaysMinor: rev!.d30 },
      pendingCheckouts: rev!.pending,
    };
  }

  async listUsers(q: AdminUserListInput): Promise<CursorPage<AdminUserRow>> {
    const where: string[] = ['u.deleted_at IS NULL'];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (q.search) {
      const term = `%${q.search.replace(/[\\%_]/g, (c) => `\\${c}`).toLowerCase()}%`;
      params.push(term);
      const i = params.length;
      where.push(`(u.email::text ILIKE $${i} OR p.username::text ILIKE $${i} OR lower(p.display_name) LIKE $${i})`);
    }
    if (q.status) add('u.status = ?', q.status);
    if (q.plan) add(`(${EFFECTIVE_PLAN}) = ?`, q.plan);
    if (q.cursor) {
      const [ts, id] = Buffer.from(q.cursor, 'base64url').toString().split('|');
      if (!ts || !id || Number.isNaN(Date.parse(ts))) throw new AppError('invalid_cursor', 'Invalid cursor', HttpStatus.UNPROCESSABLE_ENTITY);
      params.push(ts, id);
      where.push(`(u.created_at, u.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }
    params.push(q.limit + 1);
    const { rows } = await this.db.query<UserRow>(
      `${USER_SELECT} WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC, u.id DESC LIMIT $${params.length}`,
      params,
    );
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return {
      items: page.map(toRow),
      nextCursor: rows.length > q.limit && last ? Buffer.from(`${last.created_at.toISOString()}|${last.id}`).toString('base64url') : null,
    };
  }

  async user(userId: string): Promise<AdminUserDetails> {
    const row = await this.db.one<UserRow>(`${USER_SELECT} WHERE u.id = $1`, [userId]);
    if (!row) throw AppError.notFound('user_not_found', 'User not found');
    const [universes, payments, history, audit] = await Promise.all([
      this.db.query<{ slug: string }>(
        'SELECT un.slug FROM universe_members m JOIN universes un ON un.id = m.universe_id WHERE m.user_id = $1 ORDER BY un.sort_order',
        [userId],
      ),
      this.db.query<Record<string, unknown>>(`SELECT ${PAYMENT_COLUMNS} FROM payment_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]),
      this.db.query<{ created_at: Date; from_status: string | null; to_status: string; reason: string; actor: string }>(
        `SELECT h.created_at, h.from_status, h.to_status, h.reason, h.actor
           FROM subscription_status_history h JOIN subscriptions s ON s.id = h.subscription_id
          WHERE s.user_id = $1 ORDER BY h.id DESC LIMIT 50`,
        [userId],
      ),
      this.db.query<{ created_at: Date; action: string; actor: string | null; metadata: Record<string, unknown> }>(
        `SELECT a.created_at, a.action, COALESCE(au.email::text, NULL) AS actor, a.metadata
           FROM audit_logs a LEFT JOIN users au ON au.id = a.actor_user_id
          WHERE a.target_id = $1 ORDER BY a.id DESC LIMIT 50`,
        [userId],
      ),
    ]);
    return {
      ...toRow(row),
      xpTotal: row.xp_total,
      universes: universes.rows.map((r) => r.slug),
      payments: payments.rows.map(toPaymentSummary),
      history: history.rows.map((h) => ({ at: h.created_at.toISOString(), from: h.from_status, to: h.to_status, reason: h.reason, actor: h.actor })),
      audit: audit.rows.map((a) => ({ at: a.created_at.toISOString(), action: a.action, actor: a.actor, metadata: a.metadata })),
    };
  }

  private async assertTarget(admin: AuthenticatedUser, userId: string): Promise<{ email: string; roles: string[] }> {
    const t = await this.db.one<{ email: string; roles: string[] }>(
      `SELECT u.email, COALESCE((SELECT array_agg(role) FROM user_roles WHERE user_id = u.id), '{}') AS roles
         FROM users u WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId],
    );
    if (!t) throw AppError.notFound('user_not_found', 'User not found');
    return t;
  }

  /** Grants (or extends) a plan for N days. Records who granted it and why. */
  async grantPlan(admin: AuthenticatedUser, userId: string, input: GrantPlanInput, ip: string | null): Promise<AdminUserDetails> {
    await this.assertTarget(admin, userId);
    const until = await this.db.transaction(async (tx) => {
      const { rows: openRows } = await tx.query<{
        id: string; plan_code: string; status: SubscriptionStatus; current_period_end: Date | null; grace_until: Date | null;
      }>(
        `SELECT id, plan_code, status, current_period_end, grace_until FROM subscriptions
          WHERE user_id = $1 AND status IN ('pending','active','past_due','cancelled') LIMIT 1 FOR UPDATE`,
        [userId],
      );
      const open = openRows[0];
      const price = await tx.query<{ id: string }>(
        "SELECT id FROM plan_prices WHERE plan_code = $1 AND billing_interval = 'month' AND currency = 'BRL' LIMIT 1",
        [input.planCode],
      );
      if (!price.rows[0]) throw AppError.notFound('price_not_found', 'Plan price not configured');
      const actor = `admin:${admin.id}`;
      let subId: string;
      let from: string | null = null;
      if (open && open.plan_code === input.planCode) {
        from = open.status;
        await tx.query(
          `UPDATE subscriptions SET status = 'active',
                  current_period_end = GREATEST(COALESCE(current_period_end, now()), now()) + make_interval(days => $2),
                  grace_until = NULL, cancel_at_period_end = false, cancelled_at = NULL, renewal_reminder_sent_for = NULL,
                  granted_by = $3, grant_note = $4
            WHERE id = $1`,
          [open.id, input.days, admin.id, input.reason],
        );
        subId = open.id;
      } else {
        if (open) {
          await tx.query("UPDATE subscriptions SET status = 'expired' WHERE id = $1", [open.id]);
          await tx.query(
            "INSERT INTO subscription_status_history (subscription_id, from_status, to_status, reason, actor) VALUES ($1, $2, 'expired', 'replaced_by_admin_grant', $3)",
            [open.id, open.status, actor],
          );
        }
        const { rows } = await tx.query<{ id: string }>(
          `INSERT INTO subscriptions (user_id, plan_code, price_id, status, provider, current_period_start, current_period_end, granted_by, grant_note)
           VALUES ($1, $2, $3, 'active', 'manual', now(), now() + make_interval(days => $4), $5, $6) RETURNING id`,
          [userId, input.planCode, price.rows[0].id, input.days, admin.id, input.reason],
        );
        subId = rows[0]!.id;
      }
      await tx.query(
        "INSERT INTO subscription_status_history (subscription_id, from_status, to_status, reason, actor) VALUES ($1, $2, 'active', 'admin_grant', $3)",
        [subId, from, actor],
      );
      const end = await tx.query<{ e: Date }>('SELECT current_period_end AS e FROM subscriptions WHERE id = $1', [subId]);
      await this.audit.log(tx, {
        actorUserId: admin.id, action: 'admin.plan_granted', targetType: 'user', targetId: userId, ipAddress: ip,
        metadata: { plan: input.planCode, days: input.days, reason: input.reason, until: end.rows[0]!.e.toISOString() },
      });
      return end.rows[0]!.e;
    });
    await this.notifyGrant(userId, input.planCode, until);
    return this.user(userId);
  }

  private async notifyGrant(userId: string, plan: string, until: Date): Promise<void> {
    const u = await this.db.one<{ email: string; locale: Locale; timezone: string }>(
      'SELECT u.email, p.locale, p.timezone FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1',
      [userId],
    );
    if (!u) return;
    try {
      await this.mail.send({
        to: u.email,
        template: 'subscription_activated',
        locale: u.locale,
        link: `${this.env.APP_PUBLIC_URL.replace(/\/+$/, '')}/account/subscription`,
        details: { plan: PLAN_NAMES[plan] ?? plan, until: new Intl.DateTimeFormat(u.locale, { dateStyle: 'long', timeZone: u.timezone }).format(until) },
      });
    } catch (error) {
      this.logger.error(`grant email failed for ${userId}: ${(error as Error).message}`);
    }
  }

  /** Ends premium access immediately (e.g. unpaid). The user keeps a Free account. */
  async revokePlan(admin: AuthenticatedUser, userId: string, reason: string, ip: string | null): Promise<AdminUserDetails> {
    await this.assertTarget(admin, userId);
    await this.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string; status: string; plan_code: string }>(
        `SELECT id, status, plan_code FROM subscriptions
          WHERE user_id = $1 AND status IN ('pending','active','past_due','cancelled') LIMIT 1 FOR UPDATE`,
        [userId],
      );
      const open = rows[0];
      if (!open) throw AppError.notFound('no_active_subscription', 'User has no subscription to revoke');
      await tx.query(
        "UPDATE subscriptions SET status = 'expired', current_period_end = LEAST(COALESCE(current_period_end, now()), now()), grace_until = NULL WHERE id = $1",
        [open.id],
      );
      await tx.query(
        "INSERT INTO subscription_status_history (subscription_id, from_status, to_status, reason, actor) VALUES ($1, $2, 'expired', 'admin_revoked', $3)",
        [open.id, open.status, `admin:${admin.id}`],
      );
      await this.audit.log(tx, {
        actorUserId: admin.id, action: 'admin.plan_revoked', targetType: 'user', targetId: userId, ipAddress: ip,
        metadata: { plan: open.plan_code, reason },
      });
    });
    return this.user(userId);
  }

  /** Suspends the whole account: blocks sign-in and revokes all sessions. */
  async setAccountStatus(admin: AuthenticatedUser, userId: string, status: 'active' | 'suspended', reason: string, ip: string | null): Promise<AdminUserDetails> {
    const target = await this.assertTarget(admin, userId);
    if (status === 'suspended') {
      if (userId === admin.id) throw AppError.forbidden('cannot_suspend_self', 'You cannot suspend your own account');
      if (target.roles.includes('super_admin') && !admin.roles.includes('super_admin')) {
        throw AppError.forbidden('insufficient_role', 'Only a super admin can suspend a super admin');
      }
    }
    const revoked = await this.db.transaction(async (tx) => {
      await tx.query('UPDATE users SET status = $2 WHERE id = $1', [userId, status]);
      const r = status === 'suspended'
        ? await tx.query<{ id: string }>(
            "UPDATE auth_sessions SET revoked_at = now(), revoked_reason = 'suspended' WHERE user_id = $1 AND revoked_at IS NULL RETURNING id",
            [userId],
          )
        : { rows: [] as { id: string }[] };
      await this.audit.log(tx, {
        actorUserId: admin.id, action: status === 'suspended' ? 'admin.account_suspended' : 'admin.account_reactivated',
        targetType: 'user', targetId: userId, ipAddress: ip, metadata: { reason },
      });
      return r.rows.map((x) => x.id);
    });
    await this.users.invalidate(userId);
    if (revoked.length) await this.users.invalidateSession(...revoked);
    return this.user(userId);
  }

  // ---------------------------------------------------------------- moderation

  async reports(status: 'open' | 'resolved' | 'dismissed'): Promise<AdminReport[]> {
    const { rows } = await this.db.query<{
      id: string; target_type: 'topic' | 'reply'; target_id: string; reason: string; details: string | null; status: AdminReport['status'];
      created_at: Date; reporter: string; on_target: number; t_title: string | null; t_body: string | null; t_author: string | null;
      t_status: string | null; universe_slug: string | null; topic_id: string | null;
    }>(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at, ru.email::text AS reporter,
              (SELECT count(*)::int FROM reports r2 WHERE r2.target_type = r.target_type AND r2.target_id = r.target_id AND r2.status = 'open') AS on_target,
              COALESCE(t.title, rt.title) AS t_title, COALESCE(t.body, fr.body) AS t_body,
              COALESCE(ta.email::text, fa.email::text) AS t_author, COALESCE(t.status, fr.status) AS t_status,
              COALESCE(tu.slug, rtu.slug) AS universe_slug, COALESCE(t.id, rt.id) AS topic_id
         FROM reports r
         JOIN users ru ON ru.id = r.reporter_id
         LEFT JOIN forum_topics t ON r.target_type = 'topic' AND t.id = r.target_id
         LEFT JOIN users ta ON ta.id = t.author_id
         LEFT JOIN universes tu ON tu.id = t.universe_id
         LEFT JOIN forum_replies fr ON r.target_type = 'reply' AND fr.id = r.target_id
         LEFT JOIN users fa ON fa.id = fr.author_id
         LEFT JOIN forum_topics rt ON rt.id = fr.topic_id
         LEFT JOIN universes rtu ON rtu.id = rt.universe_id
        WHERE r.status = $1
        ORDER BY r.created_at DESC LIMIT 100`,
      [status],
    );
    return rows.map((r) => ({
      id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, details: r.details, status: r.status,
      createdAt: r.created_at.toISOString(), reporter: r.reporter, reportsOnTarget: r.on_target,
      content: r.t_body !== null
        ? { title: r.t_title, body: r.t_body, author: r.t_author ?? '', status: r.t_status ?? '', universeSlug: r.universe_slug ?? '', topicId: r.topic_id ?? '' }
        : null,
    }));
  }

  /** hide: removes the content from the community and resolves every open report on it. */
  async resolveReport(staff: AuthenticatedUser, reportId: string, action: 'hide' | 'dismiss', note: string | undefined, ip: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ target_type: 'topic' | 'reply'; target_id: string; status: string }>(
        'SELECT target_type, target_id, status FROM reports WHERE id = $1 FOR UPDATE',
        [reportId],
      );
      const r = rows[0];
      if (!r) throw AppError.notFound('report_not_found', 'Report not found');
      if (r.status !== 'open') throw AppError.conflict('report_closed', 'Report already handled');
      if (action === 'hide') {
        if (r.target_type === 'topic') {
          await tx.query("UPDATE forum_topics SET status = 'hidden' WHERE id = $1", [r.target_id]);
        } else {
          const h = await tx.query<{ topic_id: string }>("UPDATE forum_replies SET status = 'hidden' WHERE id = $1 AND status = 'visible' RETURNING topic_id", [r.target_id]);
          if (h.rowCount) await tx.query('UPDATE forum_topics SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = $1', [h.rows[0]!.topic_id]);
        }
        await tx.query(
          "UPDATE reports SET status = 'resolved', resolved_by = $3, resolved_at = now() WHERE target_type = $1 AND target_id = $2 AND status = 'open'",
          [r.target_type, r.target_id, staff.id],
        );
      } else {
        await tx.query("UPDATE reports SET status = 'dismissed', resolved_by = $2, resolved_at = now() WHERE id = $1", [reportId, staff.id]);
      }
      await this.audit.log(tx, {
        actorUserId: staff.id, action: action === 'hide' ? 'moderation.content_hidden' : 'moderation.report_dismissed',
        targetType: r.target_type, targetId: r.target_id, ipAddress: ip, metadata: { reportId, note: note ?? null },
      });
    });
  }
}
