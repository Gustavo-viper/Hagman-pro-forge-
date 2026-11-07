import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

export interface RunnerLogger {
  info(message: string): void;
}

export interface MigrationFile {
  version: string;
  name: string;
  path: string;
  sql: string;
  checksum: string;
}

// Arbitrary constant: serializes concurrent deploys (e.g. two API replicas) on the migration step.
const ADVISORY_LOCK_KEY = 728_401_155;

export async function loadSqlFiles(dir: string): Promise<MigrationFile[]> {
  const entries = (await readdir(dir)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  return Promise.all(
    entries.map(async (file) => {
      const sql = await readFile(join(dir, file), 'utf8');
      return {
        version: file.slice(0, 4),
        name: file.replace(/\.sql$/, ''),
        path: join(dir, file),
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
}

async function withLock<T>(client: pg.ClientBase, fn: () => Promise<T>): Promise<T> {
  await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
  try {
    return await fn();
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
  }
}

async function ensureTable(client: pg.ClientBase): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version    text PRIMARY KEY,
      name       text NOT NULL,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
}

async function inTransaction(client: pg.ClientBase, sql: string): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export interface MigrateResult {
  applied: string[];
  skipped: string[];
  policies: string[];
}

/**
 * Applies pending migrations (each in its own transaction), then re-applies every
 * idempotent policy file. Fails if an already-applied migration was edited.
 */
export async function migrate(
  client: pg.ClientBase,
  dirs: { migrations: string; policies: string },
  log: RunnerLogger,
): Promise<MigrateResult> {
  return withLock(client, async () => {
    await ensureTable(client);
    const files = await loadSqlFiles(dirs.migrations);
    const { rows } = await client.query<{ version: string; checksum: string; name: string }>(
      'SELECT version, checksum, name FROM public.schema_migrations',
    );
    const applied = new Map(rows.map((r) => [r.version, r]));
    const result: MigrateResult = { applied: [], skipped: [], policies: [] };

    const versions = new Set<string>();
    for (const file of files) {
      if (versions.has(file.version)) throw new Error(`Duplicate migration version ${file.version}`);
      versions.add(file.version);
    }

    for (const file of files) {
      const existing = applied.get(file.version);
      if (existing) {
        if (existing.checksum !== file.checksum) {
          throw new Error(
            `Migration ${file.name} was modified after being applied. ` +
              'Never edit applied migrations: create a new one instead.',
          );
        }
        result.skipped.push(file.name);
        continue;
      }
      log.info(`applying ${file.name}`);
      await inTransaction(
        client,
        `${file.sql}\n;INSERT INTO public.schema_migrations (version, name, checksum) VALUES ('${file.version}', '${file.name}', '${file.checksum}');`,
      );
      result.applied.push(file.name);
    }

    for (const policy of await loadSqlFiles(dirs.policies)) {
      log.info(`applying policy ${policy.name}`);
      await inTransaction(client, policy.sql);
      result.policies.push(policy.name);
    }
    return result;
  });
}

export async function seed(client: pg.ClientBase, dir: string, log: RunnerLogger): Promise<string[]> {
  return withLock(client, async () => {
    const done: string[] = [];
    for (const file of await loadSqlFiles(dir)) {
      log.info(`seeding ${file.name}`);
      await inTransaction(client, file.sql);
      done.push(file.name);
    }
    return done;
  });
}

export async function status(
  client: pg.ClientBase,
  migrationsDir: string,
): Promise<{ name: string; applied: boolean; modified: boolean }[]> {
  await ensureTable(client);
  const { rows } = await client.query<{ version: string; checksum: string }>(
    'SELECT version, checksum FROM public.schema_migrations',
  );
  const applied = new Map(rows.map((r) => [r.version, r.checksum]));
  return (await loadSqlFiles(migrationsDir)).map((f) => ({
    name: f.name,
    applied: applied.has(f.version),
    modified: applied.has(f.version) && applied.get(f.version) !== f.checksum,
  }));
}
