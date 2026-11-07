import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'invalid_color');

export const universeSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalid_slug')
  .min(2)
  .max(64);

/** Theme tokens stored in universe_settings.theme and applied as CSS variables on the web. */
export const universeThemeSchema = z.object({
  primary: hexColor,
  secondary: hexColor,
  accent: hexColor,
  background: hexColor,
  glow: hexColor,
});
export type UniverseTheme = z.infer<typeof universeThemeSchema>;

const localizedText = z.object({
  'pt-BR': z.string().min(1).max(2000),
  en: z.string().min(1).max(2000),
});

/** Used by the admin panel (stage 11) to register new universes without redeploying. */
export const createUniverseSchema = z.object({
  slug: universeSlugSchema,
  name: localizedText,
  tagline: localizedText,
  description: localizedText,
  theme: universeThemeSchema,
  features: z.array(z.string().regex(/^[a-z_]+$/)).max(50).default([]),
});
export type CreateUniverseInput = z.infer<typeof createUniverseSchema>;
