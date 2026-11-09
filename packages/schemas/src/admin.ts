import { z } from 'zod';

export const adminUserListSchema = z.object({
  search: z.string().trim().max(100).optional(),
  plan: z.enum(['free', 'plus', 'ultra', 'vip']).optional(),
  status: z.enum(['active', 'suspended', 'banned', 'deleted']).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminUserListInput = z.infer<typeof adminUserListSchema>;

const reason = z.string().trim().min(3, 'reason_required').max(500);

/** Grant a plan for a number of days (1 day … 2 years). Extends an active grant of the same plan. */
export const grantPlanSchema = z.object({
  planCode: z.enum(['plus', 'ultra', 'vip']),
  days: z.coerce.number().int().min(1).max(730),
  reason,
});
export type GrantPlanInput = z.infer<typeof grantPlanSchema>;

export const adminReasonSchema = z.object({ reason });
export type AdminReasonInput = z.infer<typeof adminReasonSchema>;
