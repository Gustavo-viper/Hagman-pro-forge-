import { Band, midi } from './synth';
import { parseMelody, type Step, type Theme } from './themes';

const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const FADE_IN = 2.5;
const FADE_OUT = 1.2;

interface Compiled {
  theme: Theme;
  bass: number[];
  chords: number[][];
  melody: Map<string, { m: number; steps: number }>;
}

const compiled = new WeakMap<Theme, Compiled>();
function compile(theme: Theme): Compiled {
  let c = compiled.get(theme);
  if (!c) {
    c = {
      theme,
      bass: theme.chords.map((ch) => midi(ch[0]!)),
      chords: theme.chords.map((ch) => ch.slice(1).map(midi)),
      melody: theme.melody ? parseMelody(theme.melody, theme.stepsPerBar) : new Map(),
    };
    compiled.set(theme, c);
  }
  return c;
}

/** Schedules global step `i` of a theme at audio time `t`. */
function scheduleStep(c: Compiled, band: Band, i: number, t: number, sd: number): void {
  const { theme } = c;
  const bars = theme.chords.length;
  const step = i % theme.stepsPerBar;
  const absBar = Math.floor(i / theme.stepsPerBar);
  const bar = absBar % bars;
  const s: Step = {
    bar, step, t, sd,
    cycle: Math.floor(absBar / bars),
    bass: c.bass[bar]!,
    chord: c.chords[bar]!,
    note: c.melody.get(`${bar}:${step}`),
  };
  theme.play(band, s);
}

const stepSeconds = (theme: Theme) => 60 / theme.bpm / 4;

/** Master chain: soft compressor and output gain. */
function masterChain(ctx: BaseAudioContext): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  const output = ctx.createGain();
  input.connect(comp).connect(output).connect(ctx.destination);
  return { input, output };
}

interface Playing {
  theme: Theme;
  out: GainNode;
  timer: ReturnType<typeof setInterval> | null;
  audio: HTMLAudioElement | null;
}

/**
 * Plays one theme at a time on a shared AudioContext, crossfading on changes.
 * Browsers only allow sound after a user gesture: call `unlock()` from one.
 */
export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private master: { input: GainNode; output: GainNode } | null = null;
  private current: Playing | null = null;
  private volume = 0.5;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state !== 'closed';
  }

  get playing(): Theme | null {
    return this.current?.theme ?? null;
  }

  /** Creates/resumes the audio context. Must run inside a user gesture the first time. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'playback' });
      this.master = masterChain(this.ctx);
      this.master.output.gain.value = this.volume;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.ctx && this.master) this.master.output.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  /**
   * Plays a universe theme. With `src` (an MP3 theme song) it streams the file in a loop and
   * falls back to the synthesized soundtrack if the file can't be loaded.
   */
  play(theme: Theme, src?: string): void {
    if (!this.ctx || !this.master) return;
    if (this.suspendTimer) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.current?.theme === theme) return;
    this.fadeOut();
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + FADE_IN);
    out.connect(this.master.input);
    const playing: Playing = { theme, out, timer: null, audio: null };
    this.current = playing;
    if (!src) {
      playing.timer = this.startSynth(theme, out);
      return;
    }
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.src = src;
    ctx.createMediaElementSource(audio).connect(out);
    playing.audio = audio;
    const fallback = () => {
      if (this.current !== playing || playing.timer) return;
      audio.removeAttribute('src');
      playing.audio = null;
      playing.timer = this.startSynth(theme, out);
    };
    audio.addEventListener('error', fallback, { once: true });
    audio.play().catch((e: unknown) => {
      // NotAllowedError means "no gesture yet" (the next unlock resumes); anything else: fall back.
      if (!(e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError'))) fallback();
    });
  }

  /** Name of what is playing now: an MP3 theme song or the synthesized soundtrack. */
  get source(): 'mp3' | 'synth' | null {
    return this.current ? (this.current.audio ? 'mp3' : 'synth') : null;
  }

  private startSynth(theme: Theme, out: GainNode): ReturnType<typeof setInterval> {
    const ctx = this.ctx!;
    const band = new Band(ctx, out, theme.reverb);
    const c = compile(theme);
    const sd = stepSeconds(theme);
    let i = 0;
    let next = ctx.currentTime + 0.1;
    return setInterval(() => {
      // After a throttled background period, skip ahead instead of bursting old notes.
      if (next < ctx.currentTime - 0.3) {
        const skipped = Math.ceil((ctx.currentTime - next) / sd);
        i += skipped;
        next += skipped * sd;
      }
      while (next < ctx.currentTime + LOOKAHEAD) {
        scheduleStep(c, band, i, next, sd);
        i++;
        next += sd;
      }
    }, TICK_MS);
  }

  /** Fades the current theme out; the context sleeps afterwards to save battery. */
  stop(): void {
    this.fadeOut();
    if (this.ctx && !this.suspendTimer) {
      const ctx = this.ctx;
      this.suspendTimer = setTimeout(() => {
        this.suspendTimer = null;
        if (!this.current && ctx.state === 'running') void ctx.suspend();
      }, (FADE_OUT + 0.5) * 1000);
    }
  }

  /** Pauses/resumes everything (e.g. when the tab is hidden). */
  pause(): void {
    this.current?.audio?.pause();
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (!this.current) return;
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    void this.current.audio?.play().catch(() => undefined);
  }

  /** Retries an MP3 that the browser refused to start before the first gesture. */
  kick(): void {
    const audio = this.current?.audio;
    if (audio?.paused) void audio.play().catch(() => undefined);
  }

  private fadeOut(): void {
    const cur = this.current;
    if (!cur || !this.ctx) return;
    this.current = null;
    if (cur.timer) clearInterval(cur.timer);
    const now = this.ctx.currentTime;
    cur.out.gain.cancelScheduledValues(now);
    cur.out.gain.setValueAtTime(Math.max(cur.out.gain.value, 0.0001), now);
    cur.out.gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT);
    setTimeout(() => {
      cur.audio?.pause();
      cur.audio?.removeAttribute('src');
      cur.out.disconnect();
    }, (FADE_OUT + 0.3) * 1000);
  }
}

/** Renders `seconds` of a theme offline (used by automated checks of every soundtrack). */
export async function renderTheme(theme: Theme, seconds: number, sampleRate = 22050): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const master = masterChain(ctx);
  master.output.gain.value = 0.5;
  const band = new Band(ctx, master.input, theme.reverb);
  const c = compile(theme);
  const sd = stepSeconds(theme);
  for (let i = 0, t = 0.05; t < seconds; i++, t += sd) scheduleStep(c, band, i, t, sd);
  return ctx.startRendering();
}

export const musicPlayer = new MusicPlayer();
