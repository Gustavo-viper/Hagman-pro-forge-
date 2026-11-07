import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Domain error with a stable machine-readable `code`. The web app translates codes;
 * messages are for logs/developers only.
 */
export class AppError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }

  static notFound(code: string, message = 'Resource not found'): AppError {
    return new AppError(code, message, HttpStatus.NOT_FOUND);
  }
  static forbidden(code: string, message = 'Forbidden'): AppError {
    return new AppError(code, message, HttpStatus.FORBIDDEN);
  }
  static conflict(code: string, message: string): AppError {
    return new AppError(code, message, HttpStatus.CONFLICT);
  }
  static unauthorized(code = 'unauthorized', message = 'Authentication required'): AppError {
    return new AppError(code, message, HttpStatus.UNAUTHORIZED);
  }
}
