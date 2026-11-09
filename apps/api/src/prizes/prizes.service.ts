import { Inject, Injectable } from '@nestjs/common';
import type { LocalizedText, PrizeItem } from '@fandom/types';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { SecretBox } from '../common/secret-box.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { DrawsService } from './draws.service.js';

/** Prizes won in draws and contests; codes are sealed at rest and shown only to the winner. */
@Injectable()
export class PrizesService {
  private readonly box: SecretBox;

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly draws: DrawsService,
    @Inject(ENV) env: Env,
  ) {
    this.box = new SecretBox(env.AUTH_JWT_SECRET);
  }

  async mine(user: AuthenticatedUser): Promise<PrizeItem[]> {
    const { rows } = await this.db.query<{
      id: string; source: 'draw' | 'contest'; title: LocalizedText; description: LocalizedText; position: number;
      lucky_number: number | null; code_sealed: string | null; delivered_at: Date | null; created_at: Date;
    }>(
      `SELECT z.id, z.source, COALESCE(d.title, c.title) AS title, z.description, z.position, z.lucky_number, z.code_sealed, z.delivered_at, z.created_at
         FROM prizes z
         LEFT JOIN draws d ON z.source = 'draw' AND d.id = z.source_id
         LEFT JOIN contests c ON z.source = 'contest' AND c.id = z.source_id
        WHERE z.user_id = $1 ORDER BY z.created_at DESC`,
      [user.id],
    );
    return rows.map((r) => {
      let code: string | null = null;
      if (r.code_sealed) {
        try {
          code = this.box.open(r.code_sealed);
        } catch {
          code = null; // sealed with a rotated secret: staff must re-enter it
        }
      }
      return {
        id: r.id, source: r.source, title: r.title, description: r.description, position: r.position, luckyNumber: r.lucky_number,
        code, deliveredAt: r.delivered_at?.toISOString() ?? null, createdAt: r.created_at.toISOString(),
      };
    });
  }

  /** Staff enters the prize code (Steam key, gift code); never logged or audited in clear. */
  async deliver(admin: AuthenticatedUser, prizeId: string, code: string): Promise<{ delivered: true }> {
    const p = await this.db.one<{ user_id: string; source: string; source_id: string; description: LocalizedText }>(
      'UPDATE prizes SET code_sealed = $2, delivered_at = now() WHERE id = $1 RETURNING user_id, source, source_id, description',
      [prizeId, this.box.seal(code)],
    );
    if (!p) throw AppError.notFound('prize_not_found', 'Prize not found');
    await this.audit.log(this.db.pool, { actorUserId: admin.id, action: 'admin.prize_delivered', targetType: 'prize', targetId: prizeId });
    const t = await this.db.one<{ title: LocalizedText }>(
      p.source === 'draw' ? 'SELECT title FROM draws WHERE id = $1' : 'SELECT title FROM contests WHERE id = $1',
      [p.source_id],
    );
    await this.draws.notify(p.user_id, 'prize_delivered', t?.title ?? p.description, p.description);
    return { delivered: true };
  }

  /** Staff view of contest prizes (to fill the code). */
  async contestPrize(contestId: string): Promise<{ id: string; delivered: boolean } | null> {
    return this.db.one<{ id: string; delivered: boolean }>("SELECT id, delivered_at IS NOT NULL AS delivered FROM prizes WHERE source = 'contest' AND source_id = $1", [contestId]);
  }
}
