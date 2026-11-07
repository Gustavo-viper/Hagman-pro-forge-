import { z } from 'zod';
import {
  countryCodeSchema,
  displayNameSchema,
  isoDateSchema,
  localeSchema,
  timezoneSchema,
  usernameSchema,
} from './common.js';

export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  birthdate: isoDateSchema,
  country: countryCodeSchema,
  locale: localeSchema,
  timezone: timezoneSchema,
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  marketingEmail: z.boolean().default(false),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const updatePreferencesSchema = z
  .object({
    locale: localeSchema,
    timezone: timezoneSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update');
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
