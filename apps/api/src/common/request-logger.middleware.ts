import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/** One structured line per request. Never logs headers or bodies (tokens, PII). */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const started = performance.now();
  res.on('finish', () => {
    if (req.path === '/health') return;
    const ms = Math.round(performance.now() - started);
    const line = `${req.method} ${req.path} ${res.statusCode} ${ms}ms rid=${String(req.headers['x-request-id'])}`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });
  next();
}
