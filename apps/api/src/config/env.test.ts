import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const base = { DATABASE_URL: 'postgres://x@localhost/db', AUTH_JWT_SECRET: 'x'.repeat(32) };

describe('loadEnv', () => {
  it('applies safe defaults', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.WEB_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.SUBSCRIPTION_GRACE_DAYS).toBe(3);
  });
  it('requires a strong JWT secret', () => {
    expect(() => loadEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/AUTH_JWT_SECRET/);
    expect(() => loadEnv({ ...base, AUTH_JWT_SECRET: 'short' })).toThrow(/AUTH_JWT_SECRET/);
  });
  it('requires redis and TLS for remote databases in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', DATABASE_URL: 'postgres://x@db.example.com/db' })).toThrow(
      /REDIS_URL[\s\S]*DATABASE_SSL/,
    );
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', DATABASE_URL: 'postgres://x@db.example.com/db', DATABASE_SSL: 'require', REDIS_URL: 'redis://r' }),
    ).not.toThrow();
  });
  it('accepts Railway private-network Postgres without TLS in production', () => {
    const railway = { ...base, NODE_ENV: 'production', REDIS_URL: 'redis://fandom-redis.railway.internal:6379' };
    expect(() => loadEnv({ ...railway, DATABASE_URL: 'postgresql://postgres:x@fandom-postgres.railway.internal:5432/railway' })).not.toThrow();
    expect(() => loadEnv({ ...railway, DATABASE_URL: 'postgresql://postgres:x@shuttle.proxy.rlwy.net:41234/railway' })).toThrow(/DATABASE_SSL/);
  });
  it('accepts the webhook token alone but requires the full InfinitePay set once credentials exist', () => {
    expect(() => loadEnv({ ...base, INFINITEPAY_WEBHOOK_TOKEN: 'x'.repeat(40) })).not.toThrow();
    expect(() => loadEnv({ ...base, INFINITEPAY_HANDLE: 'loja' })).toThrow(/Billing needs/);
    expect(() => loadEnv({ ...base, INFINITEPAY_HANDLE: 'loja', INFINITEPAY_API_KEY: 'inchk_x', INFINITEPAY_WEBHOOK_TOKEN: 'x'.repeat(40) })).toThrow(/Billing needs/);
    expect(() =>
      loadEnv({ ...base, INFINITEPAY_HANDLE: 'loja', INFINITEPAY_API_KEY: 'inchk_x', INFINITEPAY_WEBHOOK_TOKEN: 'x'.repeat(40), API_PUBLIC_URL: 'https://api.x.com' }),
    ).not.toThrow();
  });
  it('parses CSV origins', () => {
    expect(loadEnv({ ...base, WEB_ORIGINS: 'https://a.com, https://b.com' }).WEB_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });
});
