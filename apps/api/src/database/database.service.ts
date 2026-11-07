import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { pgSslConfig, stripSslParams } from '@fandom/shared';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

export type Queryable = Pick<pg.PoolClient, 'query'>;

// Return BIGINT (int8) as JS number. Safe: XP/coin totals are bounded far below 2^53.
pg.types.setTypeParser(20, (v) => Number.parseInt(v, 10));

/**
 * Thin wrapper over node-postgres. All SQL uses positional parameters ($1, $2 …);
 * never interpolate user input into SQL strings.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: pg.Pool;

  constructor(@Inject(ENV) env: Env) {
    this.pool = new pg.Pool({
      connectionString: stripSslParams(env.DATABASE_URL),
      ssl: pgSslConfig(env.DATABASE_SSL, env.DATABASE_CA_CERT),
      max: env.DATABASE_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 15_000,
      application_name: 'fandom-api',
    });
    this.pool.on('error', (error) => this.logger.error(`idle client error: ${error.message}`));
  }

  async query<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async one<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
    const { rows } = await this.pool.query<T>(text, params);
    return rows[0] ?? null;
  }

  /** Runs `fn` inside a transaction; rolls back on any thrown error. */
  async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<number> {
    const started = performance.now();
    await this.pool.query('SELECT 1');
    return Math.round(performance.now() - started);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
