import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { HealthResponse } from '@fandom/types';
import { Public } from '../common/decorators.js';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';

const VERSION = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? 'dev';

@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness — used by Railway's healthcheck. Does not touch dependencies. */
  @Get()
  live(): HealthResponse {
    return { status: 'ok', service: 'fandom-api', version: VERSION, uptimeSeconds: Math.round(process.uptime()) };
  }

  /** Readiness — checks PostgreSQL and Redis. 503 if the database is unreachable. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const checks: NonNullable<HealthResponse['checks']> = {};
    const probe = async (name: string, fn: () => Promise<number>) => {
      try {
        checks[name] = { status: 'ok', latencyMs: await fn() };
      } catch (error) {
        checks[name] = { status: 'error', error: (error as Error).message.slice(0, 200) };
      }
    };
    await Promise.all([probe('database', () => this.db.ping()), probe('redis', () => this.redis.ping())]);
    const dbOk = checks.database?.status === 'ok';
    const allOk = Object.values(checks).every((c) => c.status === 'ok');
    if (!dbOk) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: allOk ? 'ok' : dbOk ? 'degraded' : 'error',
      service: 'fandom-api',
      version: VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      checks,
    };
  }
}
