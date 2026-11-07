import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { JOBS, QUEUES, type EmailJobData } from '@fandom/shared';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/**
 * Transactional email producer. Messages are queued in Redis and delivered by
 * fandom-worker over SMTP (retries with backoff, never blocks the request).
 * Without Redis (local development only) the link is printed to the API log.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly queue: Queue<EmailJobData> | null;
  private readonly connection: Redis | null;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (env.REDIS_URL) {
      this.connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, family: 0 });
      this.connection.on('error', (e) => this.logger.warn(`mail queue redis error: ${e.message}`));
      this.queue = new Queue<EmailJobData>(QUEUES.email, { connection: this.connection });
    } else {
      this.connection = null;
      this.queue = null;
    }
  }

  async send(job: EmailJobData): Promise<void> {
    if (!this.queue) {
      if (this.env.NODE_ENV === 'production') throw new Error('REDIS_URL is required to send email');
      this.logger.warn(`[dev mail] ${job.template} → ${job.to}: ${job.link}`);
      return;
    }
    await this.queue.add(JOBS.sendEmail, job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    await this.connection?.quit().catch(() => undefined);
  }
}
