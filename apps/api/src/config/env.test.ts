import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const base = { DATABASE_URL: 'postgres://x@localhost/db', SUPABASE_JWT_SECRET: 'x'.repeat(32) };

describe('loadEnv', () => {
  it('applies safe defaults', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.WEB_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.SUBSCRIPTION_GRACE_DAYS).toBe(3);
  });
  it('requires a token verification method', () => {
    expect(() => loadEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/SUPABASE_URL/);
  });
  it('requires redis and TLS for remote databases in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', DATABASE_URL: 'postgres://x@db.supabase.co/db' })).toThrow(
      /REDIS_URL[\s\S]*DATABASE_SSL/,
    );
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', DATABASE_URL: 'postgres://x@db.supabase.co/db', DATABASE_SSL: 'require', REDIS_URL: 'redis://r' }),
    ).not.toThrow();
  });
  it('accepts Railway private-network Postgres without TLS in production', () => {
    const railway = { ...base, NODE_ENV: 'production', REDIS_URL: 'redis://fandom-redis.railway.internal:6379' };
    expect(() => loadEnv({ ...railway, DATABASE_URL: 'postgresql://postgres:x@fandom-postgres.railway.internal:5432/railway' })).not.toThrow();
    expect(() => loadEnv({ ...railway, DATABASE_URL: 'postgresql://postgres:x@shuttle.proxy.rlwy.net:41234/railway' })).toThrow(/DATABASE_SSL/);
  });
  it('parses CSV origins', () => {
    expect(loadEnv({ ...base, WEB_ORIGINS: 'https://a.com, https://b.com' }).WEB_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });
});
