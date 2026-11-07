import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const VALID = /^[A-Za-z0-9-]{8,100}$/;

/** Propagates (or creates) X-Request-Id for log correlation across web → api → worker. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && VALID.test(incoming) ? incoming : randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
}
