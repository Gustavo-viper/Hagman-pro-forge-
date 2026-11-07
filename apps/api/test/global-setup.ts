import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import pg from 'pg';

/** Recreates the test schema and applies real migrations + seeds before the suite. */
export default async function setup(): Promise<void> {
  if (process.env.TEST_REDIS_URL) {
    // Rate-limit counters and caches from a previous run must not leak into this one.
    const redis = new Redis(process.env.TEST_REDIS_URL);
    await redis.flushdb();
    await redis.quit();
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
  const cli = join(dirname(fileURLToPath(import.meta.url)), '../../../database/src/cli.ts');
  for (const cmd of ['migrate', 'seed']) {
    execFileSync(process.execPath, [cli, cmd], { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
  }
}
