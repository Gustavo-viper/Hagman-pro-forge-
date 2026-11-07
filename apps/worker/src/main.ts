import { createServer } from 'node:http';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import { pgSslConfig, stripSslParams } from '@fandom/shared';
import { loadEnv } from './env.js';
import { runSubscriptionLifecycle } from './jobs/subscription-lifecycle.js';
import { log } from './logger.js';
import { JOBS, QUEUES } from './queues.js';

pg.types.setTypeParser(20, (v) => Number.parseInt(v, 10));

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = new pg.Pool({
    connectionString: stripSslParams(env.DATABASE_URL),
    ssl: pgSslConfig(env.DATABASE_SSL, env.DATABASE_CA_CERT),
    max: Math.max(2, env.WORKER_CONCURRENCY),
    application_name: 'fandom-worker',
    statement_timeout: 60_000,
  });
  pool.on('error', (e) => log('error', 'pg idle client error', { error: e.message }));

  // BullMQ requires maxRetriesPerRequest: null for blocking connections. family 0 → IPv4/IPv6 (Railway).
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, family: 0 });
  connection.on('error', (e) => log('warn', 'redis error', { error: e.message }));

  const maintenance = new Queue(QUEUES.maintenance, { connection });
  // Idempotent: upserting the scheduler on every boot keeps exactly one repeat schedule.
  await maintenance.upsertJobScheduler(
    JOBS.subscriptionLifecycle,
    { every: env.SUBSCRIPTION_SWEEP_EVERY_MS },
    { name: JOBS.subscriptionLifecycle, opts: { removeOnComplete: 100, removeOnFail: 500, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } } },
  );

  const worker = new Worker(
    QUEUES.maintenance,
    async (job) => {
      switch (job.name) {
        case JOBS.subscriptionLifecycle: {
          const client = await pool.connect();
          try {
            const result = await runSubscriptionLifecycle(client, {
              graceDays: env.SUBSCRIPTION_GRACE_DAYS,
              pendingTtlHours: env.PENDING_SUBSCRIPTION_TTL_HOURS,
            });
            log('info', 'subscription lifecycle sweep', { jobId: job.id, ...result });
            return result;
          } finally {
            client.release();
          }
        }
        default:
          throw new Error(`Unknown job ${job.name}`);
      }
    },
    { connection, concurrency: env.WORKER_CONCURRENCY },
  );
  worker.on('failed', (job, error) => log('error', 'job failed', { job: job?.name, jobId: job?.id, error: error.message }));

  // Health endpoint for Railway: healthy when Redis and PostgreSQL answer.
  const server = createServer(async (req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    const checks: Record<string, string> = {};
    await Promise.all([
      pool.query('SELECT 1').then(() => (checks.database = 'ok'), (e: Error) => (checks.database = e.message)),
      connection.ping().then(() => (checks.redis = 'ok'), (e: Error) => (checks.redis = e.message)),
    ]);
    const ok = Object.values(checks).every((c) => c === 'ok') && worker.isRunning();
    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: ok ? 'ok' : 'error', service: 'fandom-worker', checks }));
  });
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EAFNOSUPPORT') server.listen(env.PORT, '0.0.0.0');
    else throw error;
  });
  server.listen(env.PORT, '::');
  log('info', 'fandom-worker started', { port: env.PORT, env: env.APP_ENV });

  const shutdown = async (signal: string) => {
    log('info', 'shutting down', { signal });
    server.close();
    await worker.close();
    await maintenance.close();
    await connection.quit().catch(() => undefined);
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  log('error', 'fatal: failed to start worker', { error: error instanceof Error ? error.stack : String(error) });
  process.exit(1);
});
