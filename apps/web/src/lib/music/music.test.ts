import { describe, expect, it } from 'vitest';
import { universeSlugFromPath } from '@/components/UniverseMusic';
import { midi } from './synth';
import { DEFAULT_THEME, parseMelody, THEMES, themeFor } from './themes';

const LAUNCH_UNIVERSES = ['harry-potter', 'supernatural', 'marvel', 'dc', 'star-wars', 'greys-anatomy', 'station-19', 'bts', 'animes', 'games'];

describe('original soundtracks', () => {
  it('parses note names', () => {
    expect(midi('C4')).toBe(60);
    expect(midi('A4')).toBe(69);
    expect(midi('C#4')).toBe(61);
    expect(midi('Bb1')).toBe(34);
    expect(() => midi('H2')).toThrow();
  });

  it('has a theme for every launch universe and a fallback for new ones', () => {
    for (const slug of LAUNCH_UNIVERSES) expect(THEMES[slug], slug).toBeDefined();
    expect(themeFor('nao-existe')).toBe(DEFAULT_THEME);
  });

  it.each([...Object.entries(THEMES), ['default', DEFAULT_THEME] as const])('%s is well-formed', (_slug, theme) => {
    expect(theme.title['pt-BR'] && theme.title.en).toBeTruthy();
    expect(theme.bpm).toBeGreaterThanOrEqual(60);
    expect(theme.bpm).toBeLessThanOrEqual(140);
    expect([12, 16]).toContain(theme.stepsPerBar);
    for (const chord of theme.chords) {
      expect(chord.length).toBeGreaterThanOrEqual(3);
      for (const n of chord) {
        expect(midi(n)).toBeGreaterThanOrEqual(midi('E1'));
        expect(midi(n)).toBeLessThanOrEqual(midi('C6'));
      }
    }
    if (theme.melody) {
      expect(theme.melody.split('|')).toHaveLength(theme.chords.length);
      const notes = parseMelody(theme.melody, theme.stepsPerBar); // throws when a bar is short or long
      for (const { m } of notes.values()) {
        expect(m).toBeGreaterThanOrEqual(midi('E3'));
        expect(m).toBeLessThanOrEqual(midi('E6'));
      }
    }
  });

  it('rejects melodies that do not fill the bar', () => {
    expect(() => parseMelody('C5:4 D5:4', 16)).toThrow(/bar 1 has 8 steps/);
  });

  it('plays inside a universe and its subpages only', () => {
    expect(universeSlugFromPath('/universes/harry-potter')).toBe('harry-potter');
    expect(universeSlugFromPath('/universes/star-wars/games/hangman')).toBe('star-wars');
    expect(universeSlugFromPath('/universes/bts/events/123')).toBe('bts');
    expect(universeSlugFromPath('/universes')).toBeNull();
    expect(universeSlugFromPath('/dashboard')).toBeNull();
  });
});
