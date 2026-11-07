import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import type { SubscriptionPlanSummary } from '@fandom/types';
import { Public } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';

const querySchema = z.object({ currency: z.string().regex(/^[A-Za-z]{3}$/).transform((c) => c.toUpperCase()).default('BRL') });

@Controller({ path: 'subscription-plans', version: '1' })
export class PlansController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  /** Active plans with prices in the requested currency (only explicitly configured prices). */
  @Public()
  @Get()
  async list(@Query(new ZodPipe(querySchema)) q: z.infer<typeof querySchema>): Promise<{ currency: string; items: SubscriptionPlanSummary[] }> {
    const items = await this.redis.cached(`plans:v1:${q.currency}`, 300, async () => {
      const { rows } = await this.db.query<{
        code: SubscriptionPlanSummary['code'];
        name: SubscriptionPlanSummary['name'];
        description: SubscriptionPlanSummary['description'];
        benefits: SubscriptionPlanSummary['benefits'];
        sort_order: number;
        prices: SubscriptionPlanSummary['prices'];
      }>(
        `SELECT p.code, p.name, p.description, p.benefits, p.sort_order,
                COALESCE(json_agg(json_build_object('interval', pr.billing_interval, 'currency', pr.currency, 'amountMinor', pr.amount_minor)
                         ORDER BY pr.billing_interval) FILTER (WHERE pr.id IS NOT NULL), '[]') AS prices
           FROM subscription_plans p
           LEFT JOIN plan_prices pr ON pr.plan_code = p.code AND pr.is_active AND pr.currency = $1
          WHERE p.is_active
          GROUP BY p.code
          ORDER BY p.sort_order`,
        [q.currency],
      );
      return rows.map((r) => ({
        code: r.code, name: r.name, description: r.description, benefits: r.benefits, prices: r.prices, sortOrder: r.sort_order,
      }));
    });
    return { currency: q.currency, items };
  }
}
