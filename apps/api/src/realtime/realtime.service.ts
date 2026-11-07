import { EventEmitter } from 'node:events';
import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

type Listener = (payload: unknown) => void;

/**
 * Fan-out of real-time events (event-room chat) to every API replica.
 * Redis pub/sub when REDIS_URL is set; in-process emitter otherwise (single instance/dev).
 */
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly local = new EventEmitter();
  private readonly pub: Redis | null;
  private readonly sub: Redis | null;
  private readonly prefix = 'rt:';

  constructor(@Inject(ENV) env: Env) {
    this.local.setMaxListeners(0);
    if (env.REDIS_URL) {
      this.pub = new Redis(env.REDIS_URL, { family: 0, maxRetriesPerRequest: 2 });
      this.sub = new Redis(env.REDIS_URL, { family: 0, maxRetriesPerRequest: null });
      for (const c of [this.pub, this.sub]) c.on('error', (e) => this.logger.warn(`realtime redis: ${e.message}`));
      void this.sub.psubscribe(`${this.prefix}*`);
      this.sub.on('pmessage', (_pattern, channel, message) => {
        try {
          this.local.emit(channel.slice(this.prefix.length), JSON.parse(message));
        } catch {
          /* ignore malformed */
        }
      });
    } else {
      this.pub = null;
      this.sub = null;
    }
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    if (this.pub) await this.pub.publish(this.prefix + channel, JSON.stringify(payload));
    else this.local.emit(channel, payload);
  }

  subscribe(channel: string, listener: Listener): () => void {
    this.local.on(channel, listener);
    return () => this.local.off(channel, listener);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.pub?.quit().catch(() => undefined), this.sub?.quit().catch(() => undefined)]);
  }
}
