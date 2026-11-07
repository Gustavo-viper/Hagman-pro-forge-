import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppError } from './app-error.js';

/** Validates and normalizes input with a shared @fandom/schemas schema. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppError(
        'validation_failed',
        'Request validation failed',
        HttpStatus.UNPROCESSABLE_ENTITY,
        result.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message })),
      );
    }
    return result.data;
  }
}
