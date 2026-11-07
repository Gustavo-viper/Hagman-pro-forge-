import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from '@fandom/types';
import { AppError } from './app-error.js';

const DEFAULT_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  413: 'payload_too_large',
  422: 'unprocessable_entity',
  429: 'rate_limited',
  500: 'internal_error',
  503: 'service_unavailable',
};

/** Uniform error envelope; never leaks stack traces or SQL errors to clients. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = req.headers['x-request-id'] as string | undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof AppError) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = 'rate_limited';
      message = 'Too many requests';
    } else if (exception instanceof HttpException) {
      // Framework exceptions may embed internals (parser errors, route paths): use a generic message.
      status = exception.getStatus();
      code = DEFAULT_CODES[status] ?? 'http_error';
      message = genericMessage(status);
    } else if (isBodyParserError(exception)) {
      status = exception.status;
      code = DEFAULT_CODES[status] ?? 'bad_request';
      message = 'Invalid request body';
    }
    const errorName = genericMessage(status);

    if (status >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`${req.method} ${req.originalUrl} [${requestId}] ${err.message}`, err.stack);
    }

    const body: ApiErrorBody = {
      statusCode: status,
      error: errorName,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    };
    res.status(status).json(body);
  }
}

function genericMessage(status: number): string {
  const name = HttpStatus[status];
  if (!name) return 'Request failed';
  const text = name.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isBodyParserError(e: unknown): e is { status: number; type: string } {
  return typeof e === 'object' && e !== null && 'type' in e && 'status' in e && typeof (e as { status: unknown }).status === 'number';
}
