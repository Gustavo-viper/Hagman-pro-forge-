import { z } from 'zod';
import { DATABASE_SSL_MODES } from '@fandom/shared';

const boolish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const csv = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Deployment environment: development | staging (homologação) | production. */
    APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),
    LOG_JSON: boolish.default(false),

    WEB_ORIGINS: csv.default(['http://localhost:5173']),

    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.enum(DATABASE_SSL_MODES).default('disable'),
    DATABASE_CA_CERT: z.string().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    REDIS_URL: z.string().optional(),

    /** HMAC secret for access tokens (HS256). >= 32 chars, random. Rotating it signs everyone out. */
    AUTH_JWT_SECRET: z.string().min(32),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),
    EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(48),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(10).max(1440).default(60),
    /** Public URL of fandom-web, used to build links in emails. */
    APP_PUBLIC_URL: z.url().default('http://localhost:5173'),

    RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

    SUBSCRIPTION_GRACE_DAYS: z.coerce.number().int().min(0).max(30).default(3),

    /** Emails that receive super_admin on first login (bootstrap only). */
    BOOTSTRAP_SUPER_ADMIN_EMAILS: csv.default([]),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.REDIS_URL) {
        ctx.addIssue({ code: 'custom', path: ['REDIS_URL'], message: 'REDIS_URL is required in production' });
      }
      if (env.DATABASE_SSL === 'disable' && !/localhost|127\.0\.0\.1|\.railway\.internal/.test(env.DATABASE_URL)) {
        ctx.addIssue({
          code: 'custom',
          path: ['DATABASE_SSL'],
          message: 'DATABASE_SSL must be require or verify-full for remote databases in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
