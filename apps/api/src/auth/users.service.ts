import { Inject, Injectable, Logger } from '@nestjs/common';
import type { StaffRole } from '@fandom/shared';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AccessTokenClaims, AuthenticatedUser } from './auth.types.js';

const CACHE_TTL_SECONDS = 60;
export const userCacheKey = (id: string) => `auth:user:${id}`;

/**
 * Mirrors Supabase Auth users into public.users / public.profiles and loads their
 * staff roles. Cached briefly in Redis; call `invalidate` after changing status/roles.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async resolve(claims: AccessTokenClaims): Promise<AuthenticatedUser> {
    const cached = await this.redis.cached(userCacheKey(claims.sub), CACHE_TTL_SECONDS, () => this.sync(claims));
    // Re-sync if the token carries newer identity data than the cache (e.g. email just verified).
    if (cached.email !== claims.email || (claims.emailVerified && !cached.emailVerified)) {
      await this.invalidate(claims.sub);
      return this.sync(claims);
    }
    return cached;
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.invalidate(userCacheKey(userId));
  }

  private async sync(claims: AccessTokenClaims): Promise<AuthenticatedUser> {
    return this.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string; email: string; email_verified: boolean; status: AuthenticatedUser['status'] }>(
        `INSERT INTO users (id, email, email_verified, last_seen_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           email_verified = users.email_verified OR EXCLUDED.email_verified,
           last_seen_at = now()
         RETURNING id, email, email_verified, status`,
        [claims.sub, claims.email, claims.emailVerified],
      );
      const user = rows[0]!;
      await tx.query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);

      await this.maybeBootstrapSuperAdmin(tx, user);

      const roles = await tx.query<{ role: StaffRole; universe_id: string | null }>(
        'SELECT role, universe_id FROM user_roles WHERE user_id = $1',
        [user.id],
      );
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        status: user.status,
        roles: [...new Set(roles.rows.map((r) => r.role))],
        moderatedUniverseIds: roles.rows.filter((r) => r.universe_id).map((r) => r.universe_id!),
      };
    });
  }

  /**
   * First-deploy bootstrap: a verified email listed in BOOTSTRAP_SUPER_ADMIN_EMAILS becomes
   * super_admin ONLY while no super_admin exists yet. Afterwards roles are granted via /admin.
   */
  private async maybeBootstrapSuperAdmin(
    tx: Parameters<Parameters<DatabaseService['transaction']>[0]>[0],
    user: { id: string; email: string; email_verified: boolean },
  ): Promise<void> {
    if (!user.email_verified || !this.env.BOOTSTRAP_SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) return;
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['bootstrap_super_admin']);
    const exists = await tx.query("SELECT 1 FROM user_roles WHERE role = 'super_admin' LIMIT 1");
    if (exists.rowCount) return;
    await tx.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'super_admin')", [user.id]);
    await this.audit.log(tx, { actorUserId: user.id, action: 'role.bootstrap_super_admin', targetType: 'user', targetId: user.id });
    this.logger.warn(`bootstrap: granted super_admin to ${user.id}`);
  }
}
