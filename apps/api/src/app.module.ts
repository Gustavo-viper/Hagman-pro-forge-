import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessGuard } from './auth/access.guard.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { RedisThrottlerStorage } from './common/redis-throttler.storage.js';
import { ConfigModule, ENV } from './config/config.module.js';
import type { Env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';
import { MeModule } from './me/me.module.js';
import { PlansModule } from './plans/plans.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RedisService } from './redis/redis.service.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { UniversesModule } from './universes/universes.module.js';
import { XpModule } from './xp/xp.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [ENV, RedisService],
      useFactory: (env: Env, redis: RedisService) => ({
        throttlers: [{ name: 'default', ttl: env.RATE_LIMIT_TTL_MS, limit: env.RATE_LIMIT_MAX }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    MailModule,
    AuthModule,
    SubscriptionsModule,
    XpModule,
    HealthModule,
    UniversesModule,
    PlansModule,
    MeModule,
  ],
  providers: [
    // Order matters: rate limit → authenticate → authorize (roles / plan).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
