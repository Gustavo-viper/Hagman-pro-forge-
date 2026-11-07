import { Injectable } from '@nestjs/common';
import type { XpSource } from '@fandom/shared';
import type { Queryable } from '../database/database.service.js';

export interface XpAward {
  userId: string;
  universeId?: string | null;
  amount: number;
  source: XpSource;
  sourceRef?: string;
  /** Deterministic key for the rewarded action, e.g. `quiz:{attemptId}`. Duplicates are ignored. */
  idempotencyKey: string;
}

/**
 * The ONLY place XP is granted. Must run inside the caller's transaction so the ledger row
 * and the totals commit atomically. Returns false when the key was already used.
 */
@Injectable()
export class XpService {
  async award(tx: Queryable, award: XpAward): Promise<boolean> {
    if (!Number.isInteger(award.amount) || award.amount === 0) throw new RangeError('invalid XP amount');
    const inserted = await tx.query(
      `INSERT INTO xp_transactions (user_id, universe_id, amount, source, source_ref, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [award.userId, award.universeId ?? null, award.amount, award.source, award.sourceRef ?? null, award.idempotencyKey],
    );
    if (!inserted.rowCount) return false;
    // GREATEST keeps totals non-negative for negative admin adjustments.
    await tx.query('UPDATE profiles SET xp_total = GREATEST(xp_total + $2, 0) WHERE user_id = $1', [
      award.userId,
      award.amount,
    ]);
    if (award.universeId) {
      await tx.query(
        'UPDATE universe_profiles SET xp = GREATEST(xp + $3, 0) WHERE universe_id = $1 AND user_id = $2',
        [award.universeId, award.userId, award.amount],
      );
    }
    return true;
  }
}
