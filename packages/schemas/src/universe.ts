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

/** Extracts the video id from a YouTube link (watch, youtu.be, embed, shorts) or a bare id. */
export function youtubeId(input: string): string | null {
  const v = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  try {
    const u = new URL(v);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    if (host === 'youtu.be') return /^\/([A-Za-z0-9_-]{11})/.exec(u.pathname)?.[1] ?? null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const q = u.searchParams.get('v');
      if (q && /^[A-Za-z0-9_-]{11}$/.test(q)) return q;
      return /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname)?.[1] ?? null;
    }
  } catch {
    // not a URL
  }
  return null;
}

/** Official theme song: a YouTube link from the rights holder (null removes it). */
export const officialThemeSchema = z.object({
  theme: z
    .object({
      url: z.string().trim().max(300).refine((v) => youtubeId(v) !== null, 'invalid_youtube_url'),
      title: z.string().trim().min(1).max(120),
      artist: z.string().trim().max(120).optional().default(''),
    })
    .nullable(),
});
export type OfficialThemeInput = z.infer<typeof officialThemeSchema>;
