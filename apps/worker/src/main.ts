import { createServer } from 'node:http';
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import { JOBS, pgSslConfig, QUEUES, stripSslParams, type EmailJobData } from '@fandom/shared';
import { loadEnv } from './env.js';
import { runAuthCleanup } from './jobs/auth-cleanup.js';
import { collectEventReminders } from './jobs/event-reminders.js';
import { collectRenewalReminders } from './jobs/renewal-reminders.js';
import { renderEmail } from './jobs/email.js';
import { runSubscriptionLifecycle } from './jobs/subscription-lifecycle.js';
import { log } from './logger.js';
import { createMailer, mailerHost } from './mailer.js';

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

  const mailer = createMailer(env);
  let smtpStatus = mailer ? 'unverified' : 'not_configured';
  if (!mailer) {
    log('warn', 'SMTP not configured (SMTP_HOST or SMTP_URL): email jobs will be retried until it is');
  } else {
    // Verify credentials at boot so misconfiguration shows up immediately in the logs.
    mailer.verify().then(
      () => {
        smtpStatus = 'ok';
        log('info', 'smtp connection verified', { host: mailerHost(env) });
      },
      (e: Error) => {
        smtpStatus = 'error';
        log('error', 'smtp verification failed', { host: mailerHost(env), error: e.message.slice(0, 300) });
      },
    );
  }

  const maintenance = new Queue(QUEUES.maintenance, { connection });
  const repeatOpts = { removeOnComplete: 100, removeOnFail: 500, attempts: 3, backoff: { type: 'exponential' as const, delay: 30_000 } };
  // Idempotent: upserting the schedulers on every boot keeps exactly one schedule each.
  await maintenance.upsertJobScheduler(JOBS.subscriptionLifecycle, { every: env.SUBSCRIPTION_SWEEP_EVERY_MS }, { name: JOBS.subscriptionLifecycle, opts: repeatOpts });
  await maintenance.upsertJobScheduler(JOBS.authCleanup, { every: 6 * 3_600_000 }, { name: JOBS.authCleanup, opts: repeatOpts });
  await maintenance.upsertJobScheduler(JOBS.renewalReminders, { every: 3_600_000 }, { name: JOBS.renewalReminders, opts: repeatOpts });
  await maintenance.upsertJobScheduler(JOBS.eventReminders, { every: 5 * 60_000 }, { name: JOBS.eventReminders, opts: repeatOpts });
  const emailQueue = new Queue<EmailJobData>(QUEUES.email, { connection });

  const withClient = async <T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  };

  const maintenanceWorker = new Worker(
    QUEUES.maintenance,
    async (job) => {
      switch (job.name) {
        case JOBS.subscriptionLifecycle: {
          const result = await withClient((c) =>
            runSubscriptionLifecycle(c, { graceDays: env.SUBSCRIPTION_GRACE_DAYS, pendingTtlHours: env.PENDING_SUBSCRIPTION_TTL_HOURS }),
          );
          log('info', 'subscription lifecycle sweep', { jobId: job.id, ...result });
          return result;
        }
        case JOBS.renewalReminders: {
          const emails = await withClient((c) =>
            collectRenewalReminders(c, { daysBefore: env.RENEWAL_REMINDER_DAYS, appUrl: env.APP_PUBLIC_URL }),
          );
          for (const e of emails) {
            await emailQueue.add(JOBS.sendEmail, e, { attempts: 5, backoff: { type: 'exponential', delay: 15_000 }, removeOnComplete: 1000, removeOnFail: 5000 });
          }
          log('info', 'renewal reminders', { jobId: job.id, queued: emails.length });
          return { queued: emails.length };
        }
        case JOBS.eventReminders: {
          const emails = await withClient((c) => collectEventReminders(c, env.APP_PUBLIC_URL));
          for (const e of emails) {
            await emailQueue.add(JOBS.sendEmail, e, { attempts: 5, backoff: { type: 'exponential', delay: 15_000 }, removeOnComplete: 1000, removeOnFail: 5000 });
          }
          if (emails.length) log('info', 'event reminders', { jobId: job.id, queued: emails.length });
          return { queued: emails.length };
        }
        case JOBS.authCleanup: {
          const result = await withClient((c) => runAuthCleanup(c));
          log('info', 'auth cleanup', { jobId: job.id, ...result });
          return result;
        }
        default:
          throw new Error(`Unknown job ${job.name}`);
      }
    },
    { connection, concurrency: env.WORKER_CONCURRENCY },
  );

  const emailWorker = new Worker<EmailJobData>(
    QUEUES.email,
    async (job: Job<EmailJobData>) => {
      if (!mailer) throw new Error('SMTP is not configured');
      const { subject, text, html } = renderEmail(job.data);
      const info = await mailer.sendMail({ from: env.EMAIL_FROM, to: job.data.to, subject, text, html });
      // Never log the link: it carries a single-use credential.
      log('info', 'email sent', { jobId: job.id, template: job.data.template, messageId: info.messageId });
    },
    { connection, concurrency: env.WORKER_CONCURRENCY },
  );

  for (const w of [maintenanceWorker, emailWorker]) {
    w.on('failed', (job, error) => log('error', 'job failed', { queue: w.name, job: job?.name, jobId: job?.id, attempt: job?.attemptsMade, error: error.message }));
  }

  // Health endpoint for Railway: healthy when Redis and PostgreSQL answer and workers run.
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
    checks.smtp = smtpStatus;
    const ok = checks.database === 'ok' && checks.redis === 'ok' && maintenanceWorker.isRunning() && emailWorker.isRunning();
    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: ok ? 'ok' : 'error', service: 'fandom-worker', checks }));
  });
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EAFNOSUPPORT') server.listen(env.PORT, '0.0.0.0');
    else throw error;
  });
  server.listen(env.PORT, '::');
  log('info', 'fandom-worker started', { port: env.PORT, env: env.APP_ENV, smtp: Boolean(mailer) });

  const shutdown = async (signal: string) => {
    log('info', 'shutting down', { signal });
    server.close();
    await Promise.all([maintenanceWorker.close(), emailWorker.close()]);
    await maintenance.close();
    await emailQueue.close();
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
