import { z } from 'zod';
import { DATABASE_SSL_MODES } from '@fandom/shared';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  /** Port for the health endpoint used by Railway. */
  PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(DATABASE_SSL_MODES).default('disable'),
  DATABASE_CA_CERT: z.string().optional(),
  REDIS_URL: z.string().min(1),
  SUBSCRIPTION_GRACE_DAYS: z.coerce.number().int().min(0).max(30).default(3),
  /** Abandoned checkouts in `pending` expire after this many hours. */
  PENDING_SUBSCRIPTION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(48),
  SUBSCRIPTION_SWEEP_EVERY_MS: z.coerce.number().int().min(60_000).default(15 * 60_000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
});
export type WorkerEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid worker configuration:\n${issues}`);
  }
  return parsed.data;
}
