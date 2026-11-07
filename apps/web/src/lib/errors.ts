import type { TFunction } from 'i18next';
import { ApiError } from './api';

/** Maps stable API / Supabase error codes to translated messages. */
export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`;
    const translated = t(key);
    return translated === key ? t('errors.generic') : translated;
  }
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    const key = `errors.auth.${(error as { code: string }).code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return t('errors.generic');
}
