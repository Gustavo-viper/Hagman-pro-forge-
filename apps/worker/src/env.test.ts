import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('worker env', () => {
  it('requires DATABASE_URL and REDIS_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL[\s\S]*REDIS_URL/);
  });
  it('applies defaults', () => {
    const env = loadEnv({ DATABASE_URL: 'postgres://x', REDIS_URL: 'redis://x' });
    expect(env.SUBSCRIPTION_GRACE_DAYS).toBe(3);
    expect(env.SUBSCRIPTION_SWEEP_EVERY_MS).toBe(900_000);
  });
});
