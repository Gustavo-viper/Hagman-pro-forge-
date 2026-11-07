import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { isDatabaseSslMode, pgSslConfig, stripSslParams } from '@fandom/shared';
import { migrate, seed, status } from './runner.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = {
  migrations: join(root, 'migrations'),
  policies: join(root, 'policies'),
  seeds: join(root, 'seeds'),
};

const log = { info: (m: string) => console.log(`[database] ${m}`) };

async function main(): Promise<void> {
  const command = process.argv[2];
  // Migrations should use a direct/session connection, not a transaction pooler
  // (DATABASE_MIGRATION_URL lets you set it separately).
  const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const mode = process.env.DATABASE_SSL ?? 'disable';
  if (!isDatabaseSslMode(mode)) throw new Error(`Invalid DATABASE_SSL: ${mode}`);

  const client = new pg.Client({
    connectionString: stripSslParams(url),
    ssl: pgSslConfig(mode, process.env.DATABASE_CA_CERT),
    application_name: 'fandom-migrations',
    statement_timeout: 120_000,
  });
  await client.connect();
  try {
    switch (command) {
      case 'migrate': {
        const r = await migrate(client, dirs, log);
        log.info(`done: ${r.applied.length} applied, ${r.skipped.length} already applied, ${r.policies.length} policy files`);
        break;
      }
      // Single entry point for platform pre-deploy hooks, which run without a shell
      // (so `migrate && seed` cannot be chained there).
      case 'deploy': {
        const r = await migrate(client, dirs, log);
        log.info(`migrate: ${r.applied.length} applied, ${r.skipped.length} already applied, ${r.policies.length} policy files`);
        const seeded = await seed(client, dirs.seeds, log);
        log.info(`seed: ${seeded.length} seed files`);
        break;
      }
      case 'seed': {
        const r = await seed(client, dirs.seeds, log);
        log.info(`done: ${r.length} seed files`);
        break;
      }
      // Operator command (run with Railway access): grant a staff role by email.
      // Used to create the first super_admin when no SMTP is configured yet.
      case 'grant-role': {
        const [email, role] = process.argv.slice(3);
        const roles = ['super_admin', 'admin', 'global_moderator', 'editor', 'support'];
        if (!email || !role || !roles.includes(role)) throw new Error(`usage: cli.ts grant-role <email> <${roles.join('|')}>`);
        const user = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
        if (!user.rows[0]) throw new Error(`no user with email ${email}`);
        await client.query('BEGIN');
        await client.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.rows[0].id, role]);
        await client.query(
          "INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata) VALUES (NULL, 'role.granted_by_operator', 'user', $1, $2)",
          [user.rows[0].id, JSON.stringify({ role })],
        );
        await client.query('COMMIT');
        log.info(`granted ${role} to ${email} (takes effect within 60s)`);
        break;
      }
      case 'status': {
        for (const m of await status(client, dirs.migrations)) {
          log.info(`${m.applied ? (m.modified ? 'MODIFIED' : 'applied ') : 'pending '} ${m.name}`);
        }
        break;
      }
      default:
        throw new Error('usage: cli.ts <migrate|seed|deploy|status|grant-role>');
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('[database] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
