/** Queue and job names shared between producers (api) and this worker. */
export const QUEUES = {
  maintenance: 'fandom-maintenance',
} as const;

export const JOBS = {
  subscriptionLifecycle: 'subscription-lifecycle',
} as const;
