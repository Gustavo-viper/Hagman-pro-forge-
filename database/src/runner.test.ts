import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSqlFiles, migrate, seed, status } from './runner.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = { migrations: join(root, 'migrations'), policies: join(root, 'policies') };
const url = process.env.TEST_DATABASE_URL;
const silent = { info: () => {} };

describe('migration files', () => {
  it('are numbered sequentially without gaps', async () => {
    const files = await loadSqlFiles(dirs.migrations);
    expect(files.length).toBeGreaterThan(0);
    files.forEach((f, i) => expect(Number(f.version)).toBe(i + 1));
  });
});

describe.runIf(Boolean(url))('runner against PostgreSQL', () => {
  const client = new pg.Client({ connectionString: url });

  beforeAll(async () => {
    await client.connect();
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });
  afterAll(async () => {
    await client.end();
  });

  it('applies every migration and policy, then is idempotent', async () => {
    const first = await migrate(client, dirs, silent);
    expect(first.applied.length).toBeGreaterThan(0);
    const second = await migrate(client, dirs, silent);
    expect(second.applied).toEqual([]);
    expect(second.skipped.length).toBe(first.applied.length);
    expect((await status(client, dirs.migrations)).every((m) => m.applied && !m.modified)).toBe(true);
  });

  it('seeds reference data idempotently', async () => {
    await seed(client, join(root, 'seeds'), silent);
    await seed(client, join(root, 'seeds'), silent);
    const u = await client.query('SELECT slug FROM universes ORDER BY sort_order');
    expect(u.rows.map((r) => r.slug)).toEqual(['harry-potter', 'supernatural', 'marvel', 'dc', 'star-wars', 'greys-anatomy', 'station-19', 'bts', 'animes', 'games']);
    const s = await client.query('SELECT count(*)::int AS n FROM universe_settings');
    expect(s.rows[0].n).toBe(10);
    const p = await client.query(
      "SELECT plan_code, billing_interval, amount_minor FROM plan_prices WHERE currency='BRL' ORDER BY plan_code, billing_interval",
    );
    expect(p.rows).toEqual([
      { plan_code: 'free', billing_interval: 'month', amount_minor: 0 },
      { plan_code: 'plus', billing_interval: 'month', amount_minor: 1490 },
      { plan_code: 'plus', billing_interval: 'year', amount_minor: 14990 },
      { plan_code: 'ultra', billing_interval: 'month', amount_minor: 2990 },
      { plan_code: 'ultra', billing_interval: 'year', amount_minor: 29990 },
    ]);
  });

  it('enables RLS on every table', async () => {
    const { rows } = await client.query(
      "SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity",
    );
    expect(rows).toEqual([]);
  });

  it('enforces XP idempotency and non-negative totals', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    await client.query("INSERT INTO users (id, email) VALUES ($1, 'x@example.com')", [id]);
    await client.query("INSERT INTO profiles (user_id) VALUES ($1)", [id]);
    const insert = () =>
      client.query(
        "INSERT INTO xp_transactions (user_id, amount, source, idempotency_key) VALUES ($1, 10, 'quiz', 'k1')",
        [id],
      );
    await insert();
    await expect(insert()).rejects.toThrow(/duplicate key/);
    await expect(client.query('UPDATE profiles SET xp_total = -1 WHERE user_id = $1', [id])).rejects.toThrow(
      /check constraint/,
    );
  });

  it('refuses edited migrations', async () => {
    await client.query("UPDATE schema_migrations SET checksum='tampered' WHERE version='0001'");
    await expect(migrate(client, dirs, silent)).rejects.toThrow(/modified after being applied/);
  });
});
