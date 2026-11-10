import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type pg from 'pg';
import type { Locale } from '@fandom/shared';
import type { ConfirmPasswordResetInput, LoginInput, RegisterInput } from '@fandom/schemas';
import type { AuthSessionResponse } from '@fandom/types';
import { ReferralsService } from '../referrals/referrals.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { MailService } from '../mail/mail.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { dummyPasswordHash, hashPassword, randomToken, sha256, verifyPassword } from './crypto.js';
import { TokenVerifierService } from './token-verifier.service.js';
import { UsersService } from './users.service.js';

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

type TokenPurpose = 'email_verification' | 'password_reset';

const MAX_FAILED_LOGINS = 10;
const FAILED_LOGIN_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly tokens: TokenVerifierService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly referrals: ReferralsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ---------------------------------------------------------------- sessions

  private async createSession(
    tx: pg.PoolClient,
    user: { id: string; email: string; email_verified: boolean },
    meta: ClientMeta,
    familyId: string = randomUUID(),
  ): Promise<AuthSessionResponse> {
    const refreshToken = randomToken();
    const expiresAt = new Date(Date.now() + this.env.AUTH_REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO auth_sessions (user_id, family_id, refresh_token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [user.id, familyId, sha256(refreshToken), meta.userAgent?.slice(0, 512) ?? null, meta.ip, expiresAt],
    );
    return {
      accessToken: await this.tokens.sign({ sub: user.id, sid: rows[0]!.id }),
      expiresIn: this.tokens.accessTtlSeconds,
      refreshToken,
      refreshExpiresAt: expiresAt.toISOString(),
      user: { id: user.id, email: user.email, emailVerified: user.email_verified },
    };
  }

  private async revokeSessions(tx: pg.PoolClient, where: string, params: unknown[], reason: string): Promise<string[]> {
    const { rows } = await tx.query<{ id: string }>(
      `UPDATE auth_sessions SET revoked_at = now(), revoked_reason = $${params.length + 1}
        WHERE revoked_at IS NULL AND ${where} RETURNING id`,
      [...params, reason],
    );
    return rows.map((r) => r.id);
  }

  // ---------------------------------------------------------------- one-time tokens

  private async issueToken(tx: pg.PoolClient, userId: string, purpose: TokenPurpose, ttlMinutes: number): Promise<string> {
    // Only the newest link of each kind stays valid.
    await tx.query('UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL', [userId, purpose]);
    const token = randomToken();
    await tx.query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
      [userId, purpose, sha256(token), ttlMinutes],
    );
    return token;
  }

  private async consumeToken(tx: pg.PoolClient, token: string, purpose: TokenPurpose): Promise<string> {
    const { rows } = await tx.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM auth_tokens
        WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
        FOR UPDATE`,
      [sha256(token), purpose],
    );
    const row = rows[0];
    if (!row) throw new AppError('invalid_or_expired_token', 'Link is invalid or expired', HttpStatus.BAD_REQUEST);
    await tx.query('UPDATE auth_tokens SET used_at = now() WHERE id = $1', [row.id]);
    return row.user_id;
  }

  private async sendLink(userId: string, email: string, purpose: TokenPurpose, token: string, ttlMinutes: number): Promise<void> {
    const locale = (await this.db.one<{ locale: Locale }>('SELECT locale FROM profiles WHERE user_id = $1', [userId]))?.locale ?? 'pt-BR';
    const path = purpose === 'email_verification' ? '/verify-email' : '/reset-password';
    const link = `${this.env.APP_PUBLIC_URL.replace(/\/+$/, '')}${path}?token=${token}`;
    try {
      await this.mail.send({ to: email, template: purpose, locale, link, expiresInMinutes: ttlMinutes });
    } catch (error) {
      // The account operation already succeeded; the user can request a new link.
      this.logger.error(`failed to queue ${purpose} email for ${userId}: ${(error as Error).message}`);
    }
  }

  // ---------------------------------------------------------------- flows

  async register(input: RegisterInput, meta: ClientMeta, locale: Locale): Promise<AuthSessionResponse> {
    const passwordHash = await hashPassword(input.password);
    const verificationTtl = this.env.EMAIL_VERIFICATION_TTL_HOURS * 60;
    let token = '';
    const session = await this.db.transaction(async (tx) => {
      let user: { id: string; email: string; email_verified: boolean };
      try {
        const { rows } = await tx.query<{ id: string; email: string; email_verified: boolean }>(
          'INSERT INTO users (email) VALUES ($1) RETURNING id, email, email_verified',
          [input.email],
        );
        user = rows[0]!;
      } catch (error) {
        if ((error as { code?: string }).code === '23505') throw AppError.conflict('email_taken', 'Email already registered');
        throw error;
      }
      await tx.query('INSERT INTO profiles (user_id, locale) VALUES ($1, $2)', [user.id, locale]);
      await tx.query('INSERT INTO auth_credentials (user_id, password_hash) VALUES ($1, $2)', [user.id, passwordHash]);
      token = await this.issueToken(tx, user.id, 'email_verification', verificationTtl);
      await this.referrals.attach(tx, user.id, input.referralCode);
      await this.audit.log(tx, {
        actorUserId: user.id, action: 'user.registered', targetType: 'user', targetId: user.id,
        ipAddress: meta.ip, requestId: meta.requestId,
      });
      return this.createSession(tx, user, meta);
    });
    await this.sendLink(session.user.id, session.user.email, 'email_verification', token, verificationTtl);
    return session;
  }

  async login(input: LoginInput, meta: ClientMeta): Promise<AuthSessionResponse> {
    const failKey = `auth:fail:${sha256(input.email)}`;
    if (this.redis.available) {
      const fails = Number((await this.redis.client!.get(failKey)) ?? 0);
      if (fails >= MAX_FAILED_LOGINS) throw new AppError('too_many_attempts', 'Too many failed attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    const row = await this.db.one<{ id: string; email: string; email_verified: boolean; status: string; password_hash: string }>(
      `SELECT u.id, u.email, u.email_verified, u.status, c.password_hash
         FROM users u JOIN auth_credentials c ON c.user_id = u.id
        WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [input.email],
    );
    const ok = await verifyPassword(input.password, row?.password_hash ?? (await dummyPasswordHash()));
    if (!row || !ok || row.status === 'deleted') {
      if (this.redis.available) {
        await this.redis.client!.multi().incr(failKey).expire(failKey, FAILED_LOGIN_WINDOW_SECONDS).exec().catch(() => undefined);
      }
      throw AppError.unauthorized('invalid_credentials', 'Invalid email or password');
    }
    if (row.status !== 'active') throw AppError.forbidden('account_suspended', 'Account suspended');
    await this.redis.invalidate(failKey);
    const session = await this.db.transaction(async (tx) => {
      if (row.email_verified) await this.maybeBootstrapSuperAdmin(tx, row.id, row.email);
      return this.createSession(tx, row, meta);
    });
    await this.users.invalidate(row.id);
    return session;
  }

  async refresh(refreshToken: string, meta: ClientMeta): Promise<AuthSessionResponse> {
    const outcome = await this.db.transaction(async (tx) => {
      const { rows } = await tx.query<{
        id: string; user_id: string; family_id: string; revoked_at: Date | null; expires_at: Date;
        email: string; email_verified: boolean; status: string;
      }>(
        `SELECT s.id, s.user_id, s.family_id, s.revoked_at, s.expires_at, u.email, u.email_verified, u.status
           FROM auth_sessions s JOIN users u ON u.id = s.user_id
          WHERE s.refresh_token_hash = $1
          FOR UPDATE OF s`,
        [sha256(refreshToken)],
      );
      const s = rows[0];
      if (!s) return { error: AppError.unauthorized('invalid_refresh_token', 'Invalid refresh token') };
      if (s.revoked_at) {
        // A rotated token was presented again: assume theft and kill the whole family.
        const revoked = await this.revokeSessions(tx, 'family_id = $1', [s.family_id], 'reuse_detected');
        await this.audit.log(tx, {
          actorUserId: s.user_id, action: 'auth.refresh_token_reused', targetType: 'user', targetId: s.user_id,
          metadata: { familyId: s.family_id }, ipAddress: meta.ip, requestId: meta.requestId,
        });
        return { error: AppError.unauthorized('refresh_token_reused', 'Session revoked'), revoked };
      }
      if (s.expires_at <= new Date() || s.status !== 'active') {
        return { error: AppError.unauthorized('invalid_refresh_token', 'Refresh token expired') };
      }
      const revoked = await this.revokeSessions(tx, 'id = $1', [s.id], 'rotated');
      const session = await this.createSession(tx, { id: s.user_id, email: s.email, email_verified: s.email_verified }, meta, s.family_id);
      return { session, revoked };
    });
    if (outcome.revoked?.length) await this.users.invalidateSession(...outcome.revoked);
    if ('error' in outcome && outcome.error) throw outcome.error;
    return outcome.session!;
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.db.transaction((tx) => this.revokeSessions(tx, 'id = $1', [user.sessionId], 'logout'));
    await this.users.invalidateSession(user.sessionId);
  }

  async requestEmailVerification(user: AuthenticatedUser): Promise<void> {
    if (user.emailVerified) throw AppError.conflict('email_already_verified', 'Email already verified');
    const ttl = this.env.EMAIL_VERIFICATION_TTL_HOURS * 60;
    const token = await this.db.transaction((tx) => this.issueToken(tx, user.id, 'email_verification', ttl));
    await this.sendLink(user.id, user.email, 'email_verification', token, ttl);
  }

  async verifyEmail(token: string, meta: ClientMeta): Promise<void> {
    const userId = await this.db.transaction(async (tx) => {
      const id = await this.consumeToken(tx, token, 'email_verification');
      const { rows } = await tx.query<{ email: string }>('UPDATE users SET email_verified = true WHERE id = $1 RETURNING email', [id]);
      await this.audit.log(tx, { actorUserId: id, action: 'user.email_verified', targetType: 'user', targetId: id, ipAddress: meta.ip, requestId: meta.requestId });
      await this.maybeBootstrapSuperAdmin(tx, id, rows[0]!.email);
      return id;
    });
    await this.users.invalidate(userId);
  }

  /** Always succeeds from the caller's point of view (no account enumeration). */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.db.one<{ id: string; email: string }>(
      "SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL AND status = 'active'",
      [email],
    );
    if (!user) return;
    const ttl = this.env.PASSWORD_RESET_TTL_MINUTES;
    const token = await this.db.transaction((tx) => this.issueToken(tx, user.id, 'password_reset', ttl));
    await this.sendLink(user.id, user.email, 'password_reset', token, ttl);
  }

  async resetPassword(input: ConfirmPasswordResetInput, meta: ClientMeta): Promise<void> {
    const passwordHash = await hashPassword(input.password);
    const { userId, revoked } = await this.db.transaction(async (tx) => {
      const id = await this.consumeToken(tx, input.token, 'password_reset');
      await tx.query('UPDATE auth_credentials SET password_hash = $2, password_changed_at = now() WHERE user_id = $1', [id, passwordHash]);
      // Opening the emailed link proves control of the address.
      await tx.query('UPDATE users SET email_verified = true WHERE id = $1', [id]);
      const revokedIds = await this.revokeSessions(tx, 'user_id = $1', [id], 'password_reset');
      await this.audit.log(tx, { actorUserId: id, action: 'auth.password_reset', targetType: 'user', targetId: id, ipAddress: meta.ip, requestId: meta.requestId });
      return { userId: id, revoked: revokedIds };
    });
    await this.users.invalidate(userId);
    if (revoked.length) await this.users.invalidateSession(...revoked);
  }

  /**
   * First-deploy bootstrap: an email in BOOTSTRAP_SUPER_ADMIN_EMAILS becomes super_admin when
   * it is verified, ONLY while no super_admin exists. Without SMTP use `cli.ts grant-role`.
   */
  private async maybeBootstrapSuperAdmin(tx: pg.PoolClient, userId: string, email: string): Promise<void> {
    if (!this.env.BOOTSTRAP_SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) return;
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['bootstrap_super_admin']);
    const exists = await tx.query("SELECT 1 FROM user_roles WHERE role = 'super_admin' LIMIT 1");
    if (exists.rowCount) return;
    await tx.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'super_admin')", [userId]);
    await this.audit.log(tx, { actorUserId: userId, action: 'role.bootstrap_super_admin', targetType: 'user', targetId: userId });
    this.logger.warn(`bootstrap: granted super_admin to ${userId}`);
  }
}
