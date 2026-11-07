import { Injectable } from '@nestjs/common';
import { levelFromXp } from '@fandom/shared';
import type { UniverseMembership, UniverseSummary } from '@fandom/types';
import { AppError } from '../common/app-error.js';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';

const LIST_CACHE_KEY = 'universes:active:v1';

const SELECT_UNIVERSE = `
  SELECT u.id, u.slug, u.name, u.tagline, u.description, u.status, u.sort_order, u.member_count,
         s.theme, s.features
    FROM universes u
    JOIN universe_settings s ON s.universe_id = u.id`;

interface UniverseRow {
  id: string;
  slug: string;
  name: UniverseSummary['name'];
  tagline: UniverseSummary['tagline'];
  description: UniverseSummary['description'];
  status: UniverseSummary['status'];
  sort_order: number;
  member_count: number;
  theme: UniverseSummary['theme'];
  features: string[];
}

const toSummary = (r: UniverseRow): UniverseSummary => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  description: r.description,
  status: r.status,
  theme: r.theme,
  features: r.features,
  memberCount: r.member_count,
  sortOrder: r.sort_order,
});

@Injectable()
export class UniversesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  listActive(): Promise<UniverseSummary[]> {
    return this.redis.cached(LIST_CACHE_KEY, 60, async () => {
      const { rows } = await this.db.query<UniverseRow>(`${SELECT_UNIVERSE} WHERE u.status = 'active' ORDER BY u.sort_order, u.slug`);
      return rows.map(toSummary);
    });
  }

  async getActive(slug: string): Promise<UniverseSummary & { identityConfig: Record<string, unknown> }> {
    const row = await this.db.one<UniverseRow & { identity_config: Record<string, unknown> }>(
      `SELECT x.*, s2.identity_config FROM (${SELECT_UNIVERSE} WHERE u.slug = $1 AND u.status = 'active') x
         JOIN universe_settings s2 ON s2.universe_id = x.id`,
      [slug],
    );
    if (!row) throw AppError.notFound('universe_not_found', 'Universe not found');
    return { ...toSummary(row), identityConfig: row.identity_config };
  }

  async memberships(userId: string): Promise<UniverseMembership[]> {
    const { rows } = await this.db.query<{
      universe_id: string; slug: string; joined_at: Date; xp: number; identity: Record<string, unknown>;
    }>(
      `SELECT m.universe_id, u.slug, m.joined_at, COALESCE(p.xp, 0) AS xp, COALESCE(p.identity, '{}'::jsonb) AS identity
         FROM universe_members m
         JOIN universes u ON u.id = m.universe_id
         LEFT JOIN universe_profiles p ON p.universe_id = m.universe_id AND p.user_id = m.user_id
        WHERE m.user_id = $1 AND u.status = 'active'
        ORDER BY u.sort_order`,
      [userId],
    );
    return rows.map((r) => ({
      universeId: r.universe_id,
      slug: r.slug,
      joinedAt: r.joined_at.toISOString(),
      xp: r.xp,
      level: levelFromXp(r.xp),
      identity: r.identity,
    }));
  }

  /** Idempotent: joining twice returns the existing membership. */
  async join(userId: string, slug: string): Promise<UniverseMembership> {
    const universe = await this.getActive(slug);
    await this.db.transaction(async (tx) => {
      const ins = await tx.query(
        'INSERT INTO universe_members (universe_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [universe.id, userId],
      );
      if (ins.rowCount) {
        await tx.query('INSERT INTO universe_profiles (universe_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
          universe.id,
          userId,
        ]);
      }
    });
    await this.redis.invalidate(LIST_CACHE_KEY);
    const membership = (await this.memberships(userId)).find((m) => m.universeId === universe.id);
    return membership!;
  }

  /**
   * Leaving removes the membership and the universe profile. The XP ledger is kept
   * (audit/anti-abuse), so re-joining cannot farm one-time rewards again.
   */
  async leave(userId: string, slug: string): Promise<void> {
    const universe = await this.getActive(slug);
    const res = await this.db.query('DELETE FROM universe_members WHERE universe_id = $1 AND user_id = $2', [
      universe.id,
      userId,
    ]);
    if (!res.rowCount) throw AppError.notFound('membership_not_found', 'Not a member of this universe');
    await this.redis.invalidate(LIST_CACHE_KEY);
  }
}
