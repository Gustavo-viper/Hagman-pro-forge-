import { Injectable } from '@nestjs/common';
import { ThrottlerStorageService, type ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service.js';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

// Atomic fixed-window counter with optional block period. Returns
// {hits, ttlMs, blockedTtlMs}.
const SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local block = tonumber(ARGV[3])
local blockedTtl = redis.call('PTTL', blockKey)
if blockedTtl > 0 then
  return {limit + 1, redis.call('PTTL', hitsKey), blockedTtl}
end
local hits = redis.call('INCR', hitsKey)
if hits == 1 then redis.call('PEXPIRE', hitsKey, ttl) end
local hitsTtl = redis.call('PTTL', hitsKey)
if hits > limit and block > 0 then
  redis.call('SET', blockKey, '1', 'PX', block)
  return {hits, hitsTtl, block}
end
return {hits, hitsTtl, 0}
`;

/**
 * Distributed rate-limit storage so limits hold across multiple API replicas.
 * Falls back to the in-memory store when Redis is not reachable (never fails open
 * silently on the counting itself: the in-memory store still limits per instance).
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly memory = new ThrottlerStorageService();

  constructor(private readonly redis: RedisService) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    if (!this.redis.available) return this.memory.increment(key, ttl, limit, blockDuration, throttlerName);
    try {
      const prefix = `rl:${throttlerName}:${key}`;
      const [hits, hitsTtl, blockedTtl] = (await this.redis.client!.eval(
        SCRIPT, 2, `${prefix}:h`, `${prefix}:b`, ttl, limit, blockDuration,
      )) as [number, number, number];
      return {
        totalHits: hits,
        timeToExpire: Math.ceil(Math.max(hitsTtl, 0) / 1000),
        isBlocked: blockedTtl > 0,
        timeToBlockExpire: Math.ceil(Math.max(blockedTtl, 0) / 1000),
      };
    } catch {
      return this.memory.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }
}
