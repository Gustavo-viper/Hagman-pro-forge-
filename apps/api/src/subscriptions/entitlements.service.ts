import { Injectable } from '@nestjs/common';
import type { BillingInterval, PlanCode, SubscriptionStatus } from '@fandom/shared';
import type { SubscriptionSnapshot } from '@fandom/types';
import { DatabaseService } from '../database/database.service.js';

interface Row {
  plan_code: PlanCode;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  current_period_end: Date | null;
  grace_until: Date | null;
  cancel_at_period_end: boolean;
}

/**
 * Decides which plan a user is ENTITLED to right now, from confirmed database state only
 * (the database is updated exclusively by verified payment webhooks — stage 10).
 *
 *   active     → entitled until current_period_end
 *   past_due   → entitled only while grace_until is in the future
 *   cancelled  → entitled until the end of the already-paid period
 *   pending / expired / none → free
 */
export function entitledPlan(row: Row | null, now: Date): PlanCode {
  if (!row) return 'free';
  const periodOk = !row.current_period_end || row.current_period_end > now;
  switch (row.status) {
    case 'active':
      return periodOk ? row.plan_code : 'free';
    case 'past_due':
      return row.grace_until && row.grace_until > now ? row.plan_code : 'free';
    case 'cancelled':
      return row.current_period_end && row.current_period_end > now ? row.plan_code : 'free';
    default:
      return 'free';
  }
}

@Injectable()
export class EntitlementsService {
  constructor(private readonly db: DatabaseService) {}

  async snapshot(userId: string, now = new Date()): Promise<SubscriptionSnapshot> {
    const row = await this.db.one<Row>(
      `SELECT s.plan_code, s.status, p.billing_interval, s.current_period_end, s.grace_until, s.cancel_at_period_end
         FROM subscriptions s JOIN plan_prices p ON p.id = s.price_id
        WHERE s.user_id = $1 AND s.status IN ('pending','active','past_due','cancelled')
        LIMIT 1`,
      [userId],
    );
    const planCode = entitledPlan(row, now);
    if (!row) return { planCode, status: 'free', interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
    return {
      planCode,
      status: row.status,
      interval: row.billing_interval,
      currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
      cancelAtPeriodEnd: row.cancel_at_period_end,
    };
  }
}
