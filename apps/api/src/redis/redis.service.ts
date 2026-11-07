import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/**
 * Redis is used for cache and distributed rate limiting (and by the worker for queues).
 * In development it is optional: when REDIS_URL is unset, cache is bypassed and rate
 * limiting falls back to in-memory. Production requires it (validated in env.ts).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis | null;

  constructor(@Inject(ENV) env: Env) {
    this.client = env.REDIS_URL
      ? new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
          lazyConnect: false,
          // Railway private networking is IPv6.
          family: 0,
        })
      : null;
    this.client?.on('error', (error) => this.logger.warn(`redis error: ${error.message}`));
    if (!this.client) this.logger.warn('REDIS_URL not set: cache disabled, in-memory rate limiting');
  }

  /** Waits (bounded) for the first connection so cache/rate-limit work from the first request. */
  async onModuleInit(): Promise<void> {
    const client = this.client;
    if (!client || client.status === 'ready') return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.logger.warn('redis not ready after 5s; continuing without it until it connects');
        resolve();
      }, 5_000);
      client.once('ready', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  get available(): boolean {
    return this.client?.status === 'ready';
  }

  /** JSON cache-aside helper. Falls through to `load` whenever Redis is unavailable. */
  async cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    if (!this.available) return load();
    try {
      const hit = await this.client!.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (error) {
      this.logger.warn(`cache read failed for ${key}: ${(error as Error).message}`);
    }
    const value = await load();
    this.client!.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch(() => undefined);
    return value;
  }

  async invalidate(...keys: string[]): Promise<void> {
    if (this.available && keys.length) await this.client!.del(...keys).catch(() => undefined);
  }

  async ping(): Promise<number> {
    if (!this.client) throw new Error('not configured');
    const started = performance.now();
    await this.client.ping();
    return Math.round(performance.now() - started);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => undefined);
  }
}
