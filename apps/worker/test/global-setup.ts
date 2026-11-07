import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** Recreates the test schema and applies real migrations + seeds before the suite. */
export default async function setup(): Promise<void> {
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
