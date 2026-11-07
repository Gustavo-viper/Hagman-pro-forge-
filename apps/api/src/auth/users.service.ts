import { Injectable } from '@nestjs/common';
import type { StaffRole } from '@fandom/shared';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { AccessTokenClaims, AuthenticatedUser } from './auth.types.js';

const CACHE_TTL_SECONDS = 60;
export const userCacheKey = (id: string) => `auth:user:${id}`;
export const sessionCacheKey = (sid: string) => `auth:session:${sid}`;

type CachedUser = Omit<AuthenticatedUser, 'sessionId'>;

/**
 * Loads the authenticated user (status, verification, staff roles) and checks that the
 * token's session is still active. Both are cached briefly in Redis; call `invalidate`
 * after changing status/roles and `invalidateSession` on logout/revocation.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async resolve(claims: AccessTokenClaims): Promise<AuthenticatedUser | null> {
    const [user, sessionActive] = await Promise.all([
      this.redis.cached(userCacheKey(claims.sub), CACHE_TTL_SECONDS, () => this.load(claims.sub)),
      this.redis.cached(sessionCacheKey(claims.sid), CACHE_TTL_SECONDS, () => this.sessionActive(claims.sid, claims.sub)),
    ]);
    if (!user || !sessionActive) return null;
    return { ...user, sessionId: claims.sid };
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.invalidate(userCacheKey(userId));
  }

  async invalidateSession(...sids: string[]): Promise<void> {
    await this.redis.invalidate(...sids.map(sessionCacheKey));
  }

  private async sessionActive(sid: string, userId: string): Promise<boolean> {
    const row = await this.db.one(
      'SELECT 1 FROM auth_sessions WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()',
      [sid, userId],
    );
    return row !== null;
  }

  async load(userId: string): Promise<CachedUser | null> {
    const user = await this.db.one<{ id: string; email: string; email_verified: boolean; status: AuthenticatedUser['status'] }>(
      'SELECT id, email, email_verified, status FROM users WHERE id = $1',
      [userId],
    );
    if (!user) return null;
    await this.db.query('UPDATE users SET last_seen_at = now() WHERE id = $1 AND (last_seen_at IS NULL OR last_seen_at < now() - interval \'5 minutes\')', [userId]);
    const roles = await this.db.query<{ role: StaffRole; universe_id: string | null }>(
      'SELECT role, universe_id FROM user_roles WHERE user_id = $1',
      [userId],
    );
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      status: user.status,
      roles: [...new Set(roles.rows.map((r) => r.role))],
      moderatedUniverseIds: roles.rows.filter((r) => r.universe_id).map((r) => r.universe_id!),
    };
  }
}
