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
  /** SMTP connection as a URL, e.g. smtps://user:pass@smtp.provider.com:465 … */
  SMTP_URL: z.string().optional(),
  /** … or as separate fields (preferred: no URL-encoding of '@' in usernames). */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('Fandom Universe <no-reply@fandomuniverse.app>'),
  /** Public URL of fandom-web, used in links inside emails sent by jobs. */
  APP_PUBLIC_URL: z.url().default('http://localhost:5173'),
  RENEWAL_REMINDER_DAYS: z.coerce.number().int().min(1).max(14).default(3),
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
