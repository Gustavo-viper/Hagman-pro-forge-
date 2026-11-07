import { z } from 'zod';
import { SUPPORTED_LOCALES } from '@fandom/shared';

export const uuidSchema = z.uuid();

export const localeSchema = z.enum(SUPPORTED_LOCALES);

/** 3-24 chars, lowercase letters, digits, underscore and dot; cannot start/end with a dot. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!\.)(?!.*\.$)(?!.*\.\.)[a-z0-9_.]{3,24}$/, 'invalid_username');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  // Reject control characters and angle brackets (defense in depth against markup injection).
  .refine((v) => !/[\u0000-\u001f\u007f<>]/.test(v), 'invalid_characters');

/** ISO 3166-1 alpha-2 */
export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'invalid_country');

export const isoDateSchema = z.iso.date();

export const timezoneSchema = z
  .string()
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'invalid_timezone');

export const cursorPaginationSchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;
