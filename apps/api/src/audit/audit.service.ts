import { Injectable } from '@nestjs/common';
import type { Queryable } from '../database/database.service.js';

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  requestId?: string | null;
}

/** Append-only audit trail. Pass the transaction client so the log commits with the change. */
@Injectable()
export class AuditService {
  async log(db: Queryable, entry: AuditEntry): Promise<void> {
    await db.query(
      `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata, ip_address, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.actorUserId,
        entry.action,
        entry.targetType ?? null,
        entry.targetId ?? null,
        JSON.stringify(entry.metadata ?? {}),
        entry.ipAddress ?? null,
        entry.requestId ?? null,
      ],
    );
  }
}
