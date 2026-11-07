import type { TFunction } from 'i18next';
import { ApiError } from './api';
import { AuthRequestError } from './session';

/** Maps stable API error codes to translated messages. */
export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError || error instanceof AuthRequestError) {
    const key = `errors.${error.code}`;
    const translated = t(key);
    return translated === key ? t('errors.generic') : translated;
  }
  return t('errors.generic');
}
