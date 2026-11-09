import type { PlanBadge } from '@fandom/types';

/** `effective_plan()` result → badge shown next to a name (null for Free). */
export const planBadge = (plan: string | null | undefined): PlanBadge => (plan === 'plus' || plan === 'ultra' || plan === 'vip' ? plan : null);
