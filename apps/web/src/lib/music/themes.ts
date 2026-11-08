/**
 * Original soundtrack themes, one per universe. Compositions written for Fandom Universe:
 * they evoke each universe's mood and do not reproduce any official theme.
 *
 * Conventions: `chords[bar]` = [bass note, ...chord tones]; `melody` uses "NOTE:steps"
 * tokens ("_" is a rest), bars separated by "|", and must fill each bar exactly.
 */
import type { LocalizedText } from '@fandom/types';
import { Band, midi } from './synth';

export interface Step {
  /** Bar inside the loop, 0-based. */
  bar: number;
  /** Step inside the bar (16th notes). */
  step: number;
  /** Audio time of the step. */
  t: number;
  /** Duration of one step in seconds. */
  sd: number;
  /** Completed loops so far (0 = intro pass). */
  cycle: number;
  bass: number;
  chord: number[];
  /** Melody note starting at this step, if any. */
  note?: { m: number; steps: number };
}

export interface Theme {
  title: LocalizedText;
  bpm: number;
  stepsPerBar: number;
  reverb: number;
  chords: string[][];
  melody?: string;
  play: (b: Band, s: Step) => void;
}

export function parseMelody(src: string, stepsPerBar: number): Map<string, { m: number; steps: number }> {
  const out = new Map<string, { m: number; steps: number }>();
  src.split('|').forEach((barSrc, bar) => {
    let pos = 0;
    for (const token of barSrc.trim().split(/\s+/)) {
      const [name, len] = token.split(':');
      const steps = Number(len);
      if (!name || !Number.isInteger(steps) || steps <= 0) throw new Error(`bad token ${token}`);
      if (name !== '_') out.set(`${bar}:${pos}`, { m: midi(name), steps });
      pos += steps;
    }
    if (pos !== stepsPerBar) throw new Error(`bar ${bar + 1} has ${pos} steps, expected ${stepsPerBar}`);
  });
  return out;
}

const T = (pt: string, en: string): LocalizedText => ({ 'pt-BR': pt, en });
/** Melody plays on most passes and rests every third one, so the loop breathes. */
const sing = (s: Step) => s.cycle % 3 !== 0;

export const THEMES: Record<string, Theme> = {
  // Waltz in D minor: celesta arpeggios, strings and a flute-like melody.
  'harry-potter': {
    title: T('Castelo encantado', 'Enchanted castle'),
    bpm: 100,
    stepsPerBar: 12,
    reverb: 0.5,
    chords: [['D2', 'D4', 'F4', 'A4'], ['Bb1', 'Bb3', 'D4', 'F4'], ['G2', 'G3', 'Bb3', 'D4'], ['A1', 'A3', 'C#4', 'E4'],
             ['D2', 'D4', 'F4', 'A4'], ['F2', 'F3', 'A3', 'C4'], ['C2', 'C4', 'E4', 'G4'], ['A1', 'A3', 'C#4', 'E4']],
    melody: 'A4:4 D5:4 E5:4 | F5:6 E5:2 D5:4 | D5:4 Bb4:4 G4:4 | A4:8 C#5:4 | D5:4 F5:4 A5:4 | C6:6 Bb5:2 A5:4 | G5:4 E5:4 C5:4 | E5:4 C#5:4 A4:4',
    play(b, s) {
      const c = s.chord;
      if (s.step === 0) {
        b.pad(c, s.t, s.sd * 12, { gain: 0.04, cutoff: 1100 });
        b.bass(s.bass, s.t, s.sd * 10, { gain: 0.11 });
      }
      if (s.step % 2 === 0) b.bell(c[[0, 1, 2, 1, 2, 1][s.step / 2]!]! + 12, s.t, { gain: 0.035 });
      if (s.step === 4 || s.step === 8) b.pluck(c[s.step === 4 ? 1 : 2]! - 12, s.t, { wave: 'triangle', gain: 0.05, decay: 0.25, cutoff: 1800 });
      if (s.note && sing(s)) b.lead(s.note.m, s.t, s.note.steps * s.sd * 0.95, { wave: 'triangle', cutoff: 3000, gain: 0.07 });
    },
  },

  // Night-drive blues rock in E minor: palm-muted power chords, bass and drums.
  supernatural: {
    title: T('Estrada à noite', 'Night road'),
    bpm: 104,
    stepsPerBar: 16,
    reverb: 0.2,
    chords: [['E2', 'E2', 'B2', 'E3'], ['E2', 'E2', 'B2', 'E3'], ['G2', 'G2', 'D3', 'G3'], ['A2', 'A2', 'E3', 'A3'],
             ['E2', 'E2', 'B2', 'E3'], ['E2', 'E2', 'B2', 'E3'], ['D2', 'D3', 'A3', 'D4'], ['B1', 'B2', 'F#3', 'B3']],
    melody: '_:16 | _:16 | _:16 | _:8 G4:2 A4:2 B4:2 D5:2 | _:16 | _:16 | _:16 | F#4:4 A4:2 B4:2 D#5:4 B4:4',
    play(b, s) {
      const hits: Record<number, number> = { 0: 3, 3: 1, 6: 2, 8: 1, 10: 2, 12: 1, 14: 1 };
      const len = hits[s.step];
      if (len) b.guitar(s.chord, s.t, len * s.sd, { gain: 0.045, muted: ![0, 6, 10].includes(s.step) });
      const intro = s.cycle === 0 && s.bar < 2;
      if (s.step % 2 === 0) b.hat(s.t, false, 0.035);
      if (intro) return;
      if (s.step === 0 || s.step === 8 || (s.step === 10 && s.bar % 2 === 1)) b.kick(s.t, 0.45);
      if (s.step === 4 || s.step === 12) b.snare(s.t, 0.15);
      if (s.step % 2 === 0) b.bass(s.bass, s.t, s.sd * 1.6, { gain: 0.12, wave: 'sawtooth', cutoff: 500 });
      if (s.note && s.cycle >= 1) b.guitar([s.note.m], s.t, s.note.steps * s.sd, { gain: 0.04 });
    },
  },

  // Heroic fanfare in C: string ostinato, brass chords and timpani.
  marvel: {
    title: T('Assembleia de heróis', 'Heroes assemble'),
    bpm: 116,
    stepsPerBar: 16,
    reverb: 0.35,
    chords: [['C2', 'C4', 'E4', 'G4'], ['Ab1', 'Ab3', 'C4', 'Eb4'], ['Bb1', 'Bb3', 'D4', 'F4'], ['C2', 'C4', 'E4', 'G4'],
             ['A1', 'A3', 'C4', 'E4'], ['F1', 'F3', 'A3', 'C4'], ['Bb1', 'Bb3', 'D4', 'F4'], ['G1', 'G3', 'B3', 'D4']],
    melody: 'C5:6 G4:2 C5:4 E5:4 | Eb5:8 C5:4 Ab4:4 | D5:6 F5:2 D5:4 Bb4:4 | C5:12 _:4 | E5:6 A5:2 G5:4 E5:4 | F5:8 C5:4 A4:4 | Bb4:4 D5:4 F5:4 Bb5:4 | G5:8 D5:4 B4:4',
    play(b, s) {
      const c = s.chord;
      b.pluck(c[[0, 1, 2, 1][s.step % 4]!]!, s.t, { gain: 0.03, decay: 0.16, cutoff: 2400 });
      if (s.step === 0) b.brass(c, s.t, s.sd * 6, { gain: 0.06 });
      if (s.step === 8) b.brass(c, s.t, s.sd * 7, { gain: 0.05 });
      if (s.step % 2 === 0) b.bass(s.bass + (s.step % 4 === 2 ? 12 : 0), s.t, s.sd * 1.5, { gain: 0.11 });
      if (s.cycle === 0 && s.bar < 4) return;
      if (s.step === 0) b.tom(s.t, s.bass + 12, 0.32);
      if (s.step === 8) b.kick(s.t, 0.35);
      if (s.step === 4 || s.step === 12 || (s.bar % 4 === 3 && s.step >= 13)) b.snare(s.t, 0.1);
      if (s.step % 2 === 0) b.hat(s.t, false, 0.025);
      if (s.note && sing(s)) b.lead(s.note.m, s.t, s.note.steps * s.sd * 0.95, { wave: 'sawtooth', cutoff: 1800, gain: 0.055 });
    },
  },

  // Dark, slow heroic theme in A minor: piano ostinato, low strings, horn melody.
  dc: {
    title: T('Vigília', 'The vigil'),
    bpm: 84,
    stepsPerBar: 16,
    reverb: 0.45,
    chords: [['A1', 'A3', 'C4', 'E4'], ['F1', 'F3', 'A3', 'C4'], ['D2', 'D3', 'F3', 'A3'], ['E1', 'E3', 'G#3', 'B3'],
             ['A1', 'A3', 'C4', 'E4'], ['F1', 'F3', 'A3', 'C4'], ['G1', 'G3', 'B3', 'D4'], ['E1', 'E3', 'G#3', 'B3']],
    melody: 'E5:8 D5:4 C5:4 | C5:8 A4:8 | D5:6 E5:2 F5:4 A5:4 | G#5:8 E5:8 | A5:8 G5:4 E5:4 | F5:8 C5:8 | D5:6 B4:2 D5:4 G5:4 | E5:16',
    play(b, s) {
      const c = s.chord;
      if (s.step === 0) {
        b.pad(c.map((m) => m - 12), s.t, s.sd * 16, { gain: 0.05, cutoff: 900 });
        b.bass(s.bass, s.t, s.sd * 15, { gain: 0.12 });
        if (s.cycle >= 1) b.brass(c.map((m) => m - 12), s.t + s.sd * 2, s.sd * 12, { gain: 0.035 });
      }
      if (s.step % 2 === 0) b.piano(c[[0, 2, 1, 2][(s.step / 2) % 4]!]! + 12, s.t, s.sd * 2, { gain: 0.045 });
      if (s.step === 0) b.kick(s.t, 0.4);
      if (s.step === 8) b.tom(s.t, s.bass + 12, 0.3);
      if (s.bar === 7 && s.step >= 12) b.tom(s.t, s.bass + 19 - (s.step - 12) * 2, 0.22);
      if (s.note && sing(s)) b.lead(s.note.m, s.t, s.note.steps * s.sd * 0.95, { wave: 'sawtooth', cutoff: 1200, gain: 0.07 });
    },
  },

  // Space adventure in G Lydian: shimmering arpeggios, strings and a noble brass line.
  'star-wars': {
    title: T('Horizonte estelar', 'Starlit horizon'),
    bpm: 100,
    stepsPerBar: 16,
    reverb: 0.55,
    chords: [['G1', 'G3', 'B3', 'D4'], ['G1', 'A3', 'C#4', 'E4'], ['E2', 'E3', 'G3', 'B3'], ['C2', 'C4', 'E4', 'G4'],
             ['G1', 'G3', 'B3', 'D4'], ['G1', 'A3', 'C#4', 'E4'], ['B1', 'B3', 'D4', 'F#4'], ['D2', 'D4', 'F#4', 'A4']],
    melody: 'B4:8 D5:4 E5:4 | F#5:8 E5:4 C#5:4 | B4:6 G4:2 E5:8 | E5:8 D5:4 C5:4 | D5:6 B4:2 G4:8 | A4:4 C#5:4 E5:8 | F#5:8 D5:8 | A4:16',
    play(b, s) {
      const c = s.chord;
      if (s.step === 0) {
        b.pad(c, s.t, s.sd * 16, { gain: 0.045, cutoff: 1600, attack: 0.9 });
        b.bass(s.bass, s.t, s.sd * 15, { gain: 0.11 });
      }
      b.bell([c[0]!, c[1]!, c[2]!, c[0]! + 12][s.step % 4]! + 12, s.t, { gain: 0.018, decay: 0.7 });
      if (s.cycle >= 1) {
        if (s.step === 0 || s.step === 8) b.tom(s.t, s.bass + 12, 0.18);
        if (s.step === 12 || s.step === 14 || s.step === 15) b.snare(s.t, 0.05);
      }
      if (s.note && sing(s)) b.brass([s.note.m], s.t, s.note.steps * s.sd * 0.95, { gain: 0.06 });
    },
  },

  // Gentle indie piano in F with a soft heartbeat.
  'greys-anatomy': {
    title: T('Plantão de inverno', 'Winter shift'),
    bpm: 78,
    stepsPerBar: 16,
    reverb: 0.4,
    chords: [['F2', 'F3', 'A3', 'C4'], ['C2', 'C3', 'E3', 'G3'], ['D2', 'D3', 'F3', 'A3'], ['Bb1', 'Bb2', 'D3', 'F3'],
             ['F2', 'F3', 'A3', 'C4'], ['C2', 'C3', 'E3', 'G3'], ['Bb1', 'Bb2', 'D3', 'F3'], ['C2', 'C3', 'E3', 'G3']],
    melody: 'A5:4 G5:2 F5:2 C5:8 | E5:4 D5:2 C5:2 G4:8 | F5:4 E5:2 D5:2 A4:4 D5:4 | D5:12 C5:4 | A5:4 C6:4 A5:4 F5:4 | G5:8 E5:8 | F5:4 D5:4 Bb4:4 D5:4 | C5:4 E5:4 G5:8',
    play(b, s) {
      const c = s.chord;
      const broken: Record<number, number> = { 0: s.bass + 12, 2: c[0]! + 12, 4: c[1]! + 12, 6: c[2]! + 12, 8: c[1]! + 12, 10: c[0]! + 24, 12: c[2]! + 12, 14: c[1]! + 12 };
      if (broken[s.step] !== undefined) b.piano(broken[s.step]!, s.t, s.sd * 3, { gain: s.step === 0 ? 0.075 : 0.05 });
      if (s.step === 0) {
        b.pad(c.map((m) => m + 12), s.t, s.sd * 16, { gain: 0.02, cutoff: 1200, attack: 1.2 });
        b.bass(s.bass, s.t, s.sd * 14, { gain: 0.08 });
      }
      if (s.cycle >= 1 || s.bar >= 4) {
        if (s.step === 0) b.kick(s.t, 0.2);
        if (s.step === 3) b.kick(s.t, 0.12);
      }
      if (s.note && sing(s)) b.piano(s.note.m, s.t, s.note.steps * s.sd, { gain: 0.085 });
    },
  },

  // Driving rescue theme in D minor: pulsing bass, drums, brass stabs.
  'station-19': {
    title: T('Prontidão', 'On call'),
    bpm: 126,
    stepsPerBar: 16,
    reverb: 0.25,
    chords: [['D2', 'D4', 'F4', 'A4'], ['Bb1', 'Bb3', 'D4', 'F4'], ['F2', 'F3', 'A3', 'C4'], ['C2', 'C4', 'E4', 'G4'],
             ['D2', 'D4', 'F4', 'A4'], ['Bb1', 'Bb3', 'D4', 'F4'], ['G1', 'G3', 'Bb3', 'D4'], ['A1', 'A3', 'C#4', 'E4']],
    melody: 'D5:3 D5:3 F5:2 A5:8 | G5:4 F5:4 D5:8 | C5:3 C5:3 F5:2 A5:8 | G5:4 E5:4 C5:8 | D5:3 D5:3 F5:2 A5:4 D6:4 | C6:4 Bb5:4 F5:8 | G5:4 Bb5:4 D6:8 | C#6:8 A5:8',
    play(b, s) {
      const c = s.chord;
      if (s.step % 2 === 0) b.bass(s.bass, s.t, s.sd * 1.5, { gain: 0.12, wave: 'sawtooth', cutoff: 520 });
      b.pluck(c[[0, 1, 2, 1][s.step % 4]!]! + 12, s.t, { gain: 0.022, decay: 0.12, wave: 'square', cutoff: 3000 });
      if (s.step === 0 || s.step === 10) b.brass(c, s.t, s.sd * 2, { gain: 0.05 });
      if (s.cycle === 0 && s.bar < 2) return;
      b.hat(s.t, false, s.step % 2 === 0 ? 0.03 : 0.015);
      if (s.step === 0 || s.step === 6 || s.step === 8) b.kick(s.t, 0.45);
      if (s.step === 4 || s.step === 12) b.snare(s.t, 0.14);
      if (s.bar === 7 && s.step >= 12) b.tom(s.t, midi('A3') - (s.step - 12) * 3, 0.25);
      if (s.note && sing(s)) b.lead(s.note.m, s.t, s.note.steps * s.sd * 0.9, { wave: 'square', cutoff: 2000, gain: 0.04 });
    },
  },

  // Bright synth-pop in A major (vi–IV–I–V): four-on-the-floor, plucks and a hook.
  bts: {
    title: T('Brilho roxo', 'Purple glow'),
    bpm: 112,
    stepsPerBar: 16,
    reverb: 0.3,
    chords: [['F#1', 'F#3', 'A3', 'C#4'], ['D2', 'D4', 'F#4', 'A4'], ['A1', 'A3', 'C#4', 'E4'], ['E2', 'E4', 'G#4', 'B4'],
             ['F#1', 'F#3', 'A3', 'C#4'], ['D2', 'D4', 'F#4', 'A4'], ['A1', 'A3', 'C#4', 'E4'], ['E2', 'E4', 'G#4', 'B4']],
    melody: 'C#5:3 E5:3 F#5:2 _:2 E5:2 C#5:4 | D5:3 F#5:3 A5:2 _:4 F#5:4 | E5:3 C#5:3 A4:2 _:2 B4:2 C#5:4 | B4:6 G#4:2 E5:8 | C#5:3 E5:3 F#5:2 _:2 E5:2 C#5:4 | D5:3 F#5:3 A5:2 _:4 F#5:4 | E5:3 C#5:3 A4:2 _:2 B4:2 C#5:4 | B4:4 C#5:4 E5:4 G#5:4',
    play(b, s) {
      const c = s.chord;
      if (s.step === 0) b.pad(c, s.t, s.sd * 16, { gain: 0.03, cutoff: 2600, attack: 0.3 });
      if (s.step % 2 === 0) b.bass(s.bass + (s.step % 4 === 2 ? 12 : 0) + 12, s.t, s.sd * 1.4, { gain: 0.11, wave: 'sawtooth', cutoff: 650 });
      const pl: Record<number, number> = { 0: 0, 3: 1, 6: 2, 8: 1, 11: 2, 14: 0 };
      if (pl[s.step] !== undefined) b.pluck(c[pl[s.step]!]! + 12, s.t, { gain: 0.045, decay: 0.22, wave: 'square', cutoff: 3500 });
      if (s.cycle === 0 && s.bar < 2) return;
      if (s.step % 4 === 0) b.kick(s.t, 0.45);
      if (s.step === 4 || s.step === 12) b.clap(s.t, 0.13);
      if (s.step % 4 === 2) b.hat(s.t, true, 0.035);
      else if (s.step % 2 === 1) b.hat(s.t, false, 0.02);
      if (s.note && sing(s)) b.lead(s.note.m, s.t, s.note.steps * s.sd * 0.9, { wave: 'sawtooth', cutoff: 3000, gain: 0.045 });
    },
  },
};

THEMES.animes = {
  // Anime-opening energy in E major (IV–V–iii–vi): driving band, bright plucks and a soaring lead.
  title: T('Céu de festival', 'Festival sky'),
  bpm: 138,
  stepsPerBar: 16,
  reverb: 0.3,
  chords: [['A1', 'A3', 'C#4', 'E4'], ['B1', 'B3', 'D#4', 'F#4'], ['G#1', 'G#3', 'B3', 'D#4'], ['C#2', 'C#4', 'E4', 'G#4'],
           ['A1', 'A3', 'C#4', 'E4'], ['B1', 'B3', 'D#4', 'F#4'], ['G#1', 'G#3', 'B3', 'D#4'], ['C#2', 'C#4', 'E4', 'G#4']],
  melody: 'E5:4 F#5:2 G#5:2 A5:4 G#5:4 | F#5:6 D#5:2 B4:8 | B4:4 D#5:4 G#5:4 F#5:4 | E5:12 _:4 | C#6:4 B5:2 A5:2 G#5:4 E5:4 | F#5:4 G#5:4 A5:4 B5:4 | G#5:6 F#5:2 D#5:8 | C#5:8 E5:4 G#5:4',
  play(b, s) {
    const c = s.chord;
    if (s.step === 0) b.pad(c, s.t, s.sd * 16, { gain: 0.03, cutoff: 2400, attack: 0.2 });
    if (s.step % 2 === 0) b.bass(s.bass + 12, s.t, s.sd * 1.5, { gain: 0.11, wave: 'sawtooth', cutoff: 700 });
    b.pluck(c[[0, 1, 2, 1][s.step % 4]!]! + 12, s.t, { gain: 0.025, decay: 0.14, wave: 'square', cutoff: 3600 });
    if (s.step === 0 || s.step === 10) b.guitar(c.map((m) => m - 12), s.t, s.sd * 3, { gain: 0.03 });
    if (s.cycle === 0 && s.bar < 2) return;
    if (s.step === 0 || s.step === 8 || s.step === 11) b.kick(s.t, 0.42);
    if (s.step === 4 || s.step === 12) b.snare(s.t, 0.14);
    if (s.step % 2 === 0) b.hat(s.t, s.step % 4 === 2, 0.03);
    if (s.note && sing(s)) b.lead(s.note.m, s.t, s.note.steps * s.sd * 0.92, { wave: 'sawtooth', cutoff: 3200, gain: 0.045 });
  },
};

THEMES.games = {
  // Chiptune adventure in A minor: square-wave arpeggios, triangle bass and noise drums.
  title: T('Pixel em fuga', 'Pixel getaway'),
  bpm: 140,
  stepsPerBar: 16,
  reverb: 0.12,
  chords: [['A1', 'A3', 'C4', 'E4'], ['F1', 'F3', 'A3', 'C4'], ['C2', 'C4', 'E4', 'G4'], ['G1', 'G3', 'B3', 'D4'],
           ['A1', 'A3', 'C4', 'E4'], ['F1', 'F3', 'A3', 'C4'], ['C2', 'C4', 'E4', 'G4'], ['G1', 'G3', 'B3', 'D4']],
  melody: 'A4:2 C5:2 E5:2 A5:2 G5:4 E5:4 | F5:4 E5:2 C5:2 A4:8 | G4:2 C5:2 E5:2 G5:2 E5:4 C5:4 | D5:6 B4:2 G4:8 | E5:2 E5:2 A5:4 G5:2 E5:2 C5:4 | F5:2 A5:2 C6:4 A5:4 F5:4 | E5:4 G5:4 C6:4 G5:4 | B5:8 D6:4 B5:4',
  play(b, s) {
    const c = s.chord;
    b.pluck(c[[0, 1, 2, 1][s.step % 4]!]! + 12, s.t, { gain: 0.028, decay: 0.09, wave: 'square', cutoff: 5000, wet: 0.1 });
    if (s.step % 2 === 0) b.bass(s.bass + (s.step % 4 === 2 ? 24 : 12), s.t, s.sd * 1.6, { gain: 0.12, wave: 'triangle', cutoff: 1200 });
    if (s.cycle === 0 && s.bar < 2) return;
    if (s.step === 0 || s.step === 6 || s.step === 8) b.kick(s.t, 0.35);
    if (s.step === 4 || s.step === 12) b.snare(s.t, 0.12);
    if (s.step % 2 === 1) b.hat(s.t, false, 0.025);
    if (s.note && sing(s)) b.lead(s.note.m, s.t, s.note.steps * s.sd * 0.85, { wave: 'square', cutoff: 4000, gain: 0.035, wet: 0.15 });
  },
};

/** Calm generic theme for universes added later without their own soundtrack. */
export const DEFAULT_THEME: Theme = {
  title: T('Multiverso', 'Multiverse'),
  bpm: 88,
  stepsPerBar: 16,
  reverb: 0.5,
  chords: [['C2', 'C4', 'E4', 'G4'], ['A1', 'A3', 'C4', 'E4'], ['F1', 'F3', 'A3', 'C4'], ['G1', 'G3', 'B3', 'D4']],
  play(b, s) {
    const c = s.chord;
    if (s.step === 0) {
      b.pad(c, s.t, s.sd * 16, { gain: 0.04, cutoff: 1300, attack: 1 });
      b.bass(s.bass, s.t, s.sd * 15, { gain: 0.09 });
    }
    if (s.step % 2 === 0) b.bell(c[[0, 1, 2, 1][(s.step / 2) % 4]!]! + 12, s.t, { gain: 0.025 });
  },
};

export const themeFor = (slug: string): Theme => THEMES[slug] ?? DEFAULT_THEME;
