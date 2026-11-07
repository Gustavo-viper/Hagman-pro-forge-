import 'reflect-metadata';
import { type INestApplication, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';
import { requestId } from './common/request-id.middleware.js';
import { requestLogger } from './common/request-logger.middleware.js';

export async function createApp(options: { logger?: boolean } = {}): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
    ...(options.logger === false ? { logger: false } : {}),
  });
  const env = app.get<Env>(ENV);

  if (options.logger !== false) {
    const { ConsoleLogger } = await import('@nestjs/common');
    const levels = ['error', 'warn', 'log', 'debug', 'verbose'] as const;
    app.useLogger(
      new ConsoleLogger({
        json: env.LOG_JSON,
        colors: !env.LOG_JSON,
        logLevels: levels.slice(0, levels.indexOf(env.LOG_LEVEL) + 1) as never,
      }),
    );
  }

  // Railway (and most PaaS) terminate TLS at a proxy: trust exactly one hop for req.ip.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '256kb' });
  app.use(requestId, requestLogger);
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.enableCors({
    origin: env.WEB_ORIGINS,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
  return app;
}
