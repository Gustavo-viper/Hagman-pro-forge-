/**
 * Theme songs supplied as MP3 files (apps/web/public/music/<slug>.mp3).
 *
 * Only add a track the Forge Studios team has the right to use (own production,
 * license or written permission) and fill `credit` as the license requires.
 * Universes without an entry keep their original synthesized soundtrack, which
 * also plays if a file fails to load.
 */
export interface Mp3Track {
  /** Bump when the file is replaced, so browsers drop the cached copy. */
  version: number;
  title: string;
  credit?: string;
}

export const MP3_TRACKS: Partial<Record<string, Mp3Track>> = {};

export const trackUrl = (slug: string, track: Mp3Track) => `/music/${slug}.mp3?v=${track.version}`;
