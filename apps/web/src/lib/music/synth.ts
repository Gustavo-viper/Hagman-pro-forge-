/**
 * Small Web Audio synthesizer used by the original universe soundtracks. Everything is
 * generated in the browser: no audio files, no third-party recordings.
 */

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#4" → 61, "Bb2" → 46. Throws on invalid names (themes are validated by tests). */
export function midi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`invalid note ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + NOTE_INDEX[m[1]!]! + acc;
}

export const freq = (m: number) => 440 * 2 ** ((m - 69) / 12);

function impulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

/** Odd length so that silence maps exactly to 0 (no DC offset). */
function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1025;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

interface Env { a: number; d: number; s: number; r: number; peak: number }

/** One band per playback: instruments → dry + reverb send → output. */
export class Band {
  private readonly dry: GainNode;
  private readonly send: GainNode;
  private readonly noise: AudioBuffer;
  private readonly curve = distortionCurve(18);

  constructor(readonly ctx: BaseAudioContext, out: AudioNode, reverb = 0.35) {
    this.dry = ctx.createGain();
    this.dry.connect(out);
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 3, 2.6);
    this.send = ctx.createGain();
    this.send.gain.value = reverb;
    this.send.connect(verb).connect(out);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Gain with an ADSR envelope, routed dry and to the reverb (wet 0..1). */
  private amp(t: number, dur: number, e: Env, wet: number): GainNode {
    const g = this.ctx.createGain();
    const p = g.gain;
    p.value = 0; // silent until the note starts (the default gain is 1)
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(e.peak, t + e.a);
    p.setTargetAtTime(e.peak * e.s, t + e.a, Math.max(0.01, e.d / 3));
    p.setTargetAtTime(0.0001, t + Math.max(dur, e.a), Math.max(0.01, e.r / 4));
    g.connect(this.dry);
    if (wet > 0) {
      const w = this.ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.send);
    }
    return g;
  }

  private osc(type: OscillatorType, m: number, t: number, end: number, dest: AudioNode, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq(m);
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(end);
    return o;
  }

  private lowpass(cutoff: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    f.Q.value = q;
    return f;
  }

  /** Warm string/synth pad: two detuned saws per note through a lowpass. */
  pad(notes: number[], t: number, dur: number, o: { gain?: number; cutoff?: number; attack?: number; wet?: number } = {}): void {
    const r = 1.4;
    const f = this.lowpass(o.cutoff ?? 1400);
    f.connect(this.amp(t, dur, { a: o.attack ?? 0.6, d: 0.5, s: 0.85, r, peak: (o.gain ?? 0.05) / Math.sqrt(notes.length) }, o.wet ?? 0.6));
    for (const m of notes) {
      this.osc('sawtooth', m, t, t + dur + r, f, -7);
      this.osc('sawtooth', m, t, t + dur + r, f, 7);
    }
  }

  /** Plucked synth / pizzicato: filtered wave with a fast decay. */
  pluck(m: number, t: number, o: { gain?: number; decay?: number; wave?: OscillatorType; cutoff?: number; wet?: number } = {}): void {
    const decay = o.decay ?? 0.35;
    const f = this.lowpass(o.cutoff ?? 3200, 1.2);
    f.frequency.setValueAtTime(o.cutoff ?? 3200, t);
    f.frequency.exponentialRampToValueAtTime(500, t + decay);
    f.connect(this.amp(t, 0.01, { a: 0.004, d: decay, s: 0.0001, r: decay, peak: o.gain ?? 0.1 }, o.wet ?? 0.35));
    this.osc(o.wave ?? 'sawtooth', m, t, t + decay * 1.5 + 0.05, f);
  }

  /** Celesta / music-box bell: sine plus a soft high partial. */
  bell(m: number, t: number, o: { gain?: number; decay?: number; wet?: number } = {}): void {
    const decay = o.decay ?? 1.1;
    const g = this.amp(t, 0.01, { a: 0.003, d: decay, s: 0.0001, r: decay, peak: o.gain ?? 0.07 }, o.wet ?? 0.6);
    this.osc('sine', m, t, t + decay * 1.5, g);
    const h = this.ctx.createGain();
    h.gain.value = 0.25;
    h.connect(g);
    this.osc('sine', m + 24, t, t + decay, h);
  }

  /** Soft piano-like tone. */
  piano(m: number, t: number, dur: number, o: { gain?: number; wet?: number } = {}): void {
    const g = this.amp(t, dur, { a: 0.005, d: 1.2, s: 0.25, r: 0.6, peak: o.gain ?? 0.09 }, o.wet ?? 0.4);
    const f = this.lowpass(2600);
    f.connect(g);
    this.osc('triangle', m, t, t + dur + 0.8, f);
    const h = this.ctx.createGain();
    h.gain.value = 0.18;
    h.connect(f);
    this.osc('sine', m + 12, t, t + dur + 0.6, h);
  }

  /** Bass: triangle with a sine sub. */
  bass(m: number, t: number, dur: number, o: { gain?: number; wave?: OscillatorType; cutoff?: number } = {}): void {
    const f = this.lowpass(o.cutoff ?? 700);
    f.connect(this.amp(t, dur, { a: 0.01, d: 0.2, s: 0.7, r: 0.12, peak: o.gain ?? 0.16 }, 0.05));
    this.osc(o.wave ?? 'triangle', m, t, t + dur + 0.2, f);
    this.osc('sine', m - 12, t, t + dur + 0.2, f);
  }

  /** Lead voice with gentle vibrato (flute, horn, synth). */
  lead(m: number, t: number, dur: number, o: { gain?: number; wave?: OscillatorType; cutoff?: number; wet?: number } = {}): void {
    const f = this.lowpass(o.cutoff ?? 2200);
    f.connect(this.amp(t, dur, { a: 0.04, d: 0.2, s: 0.8, r: 0.25, peak: o.gain ?? 0.06 }, o.wet ?? 0.45));
    const osc = this.osc(o.wave ?? 'sawtooth', m, t, t + dur + 0.4, f);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(9, t + Math.min(0.4, dur));
    lfo.connect(depth).connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.4);
  }

  /** Brass section: saws with a filter swell. */
  brass(notes: number[], t: number, dur: number, o: { gain?: number; wet?: number } = {}): void {
    const f = this.lowpass(400, 1.5);
    f.frequency.setValueAtTime(400, t);
    f.frequency.linearRampToValueAtTime(2400, t + 0.12);
    f.frequency.setTargetAtTime(1500, t + 0.12, 0.3);
    f.connect(this.amp(t, dur, { a: 0.05, d: 0.3, s: 0.75, r: 0.3, peak: (o.gain ?? 0.07) / Math.sqrt(notes.length) }, o.wet ?? 0.45));
    for (const m of notes) {
      this.osc('sawtooth', m, t, t + dur + 0.5, f, -5);
      this.osc('sawtooth', m, t, t + dur + 0.5, f, 5);
    }
  }

  /** Overdriven guitar (power chords or single notes). */
  guitar(notes: number[], t: number, dur: number, o: { gain?: number; muted?: boolean } = {}): void {
    const pre = this.ctx.createGain();
    pre.gain.value = 0.6;
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.curve;
    const f = this.lowpass(o.muted ? 1300 : 2800, 0.9);
    pre.connect(shaper).connect(f);
    const g = this.amp(t, o.muted ? 0.06 : dur, { a: 0.005, d: o.muted ? 0.08 : 0.4, s: o.muted ? 0.0001 : 0.7, r: 0.1, peak: o.gain ?? 0.07 }, 0.15);
    f.connect(g);
    for (const m of notes) {
      this.osc('sawtooth', m, t, t + dur + 0.2, pre, -4);
      this.osc('sawtooth', m, t, t + dur + 0.2, pre, 4);
    }
  }

  private noiseHit(t: number, dur: number, type: BiquadFilterType, cutoff: number, gain: number, wet = 0.1): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = cutoff;
    const g = this.amp(t, 0.001, { a: 0.001, d: dur, s: 0.0001, r: dur, peak: gain }, wet);
    src.connect(f).connect(g);
    src.start(t);
    src.stop(t + dur * 2 + 0.05);
  }

  kick(t: number, gain = 0.5): void {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const g = this.amp(t, 0.001, { a: 0.002, d: 0.35, s: 0.0001, r: 0.3, peak: gain }, 0);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.5);
  }

  snare(t: number, gain = 0.18): void {
    this.noiseHit(t, 0.16, 'highpass', 1400, gain, 0.2);
    const g = this.amp(t, 0.001, { a: 0.001, d: 0.08, s: 0.0001, r: 0.08, peak: gain * 0.6 }, 0);
    this.osc('triangle', midi('G3'), t, t + 0.15, g);
  }

  clap(t: number, gain = 0.16): void {
    for (const dt of [0, 0.012, 0.024]) this.noiseHit(t + dt, 0.09, 'bandpass', 1600, gain, 0.25);
  }

  hat(t: number, open = false, gain = 0.05): void {
    this.noiseHit(t, open ? 0.22 : 0.04, 'highpass', 7500, gain, 0.05);
  }

  tom(t: number, m: number, gain = 0.3): void {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq(m), t);
    o.frequency.exponentialRampToValueAtTime(freq(m) * 0.62, t + 0.3);
    const g = this.amp(t, 0.001, { a: 0.003, d: 0.45, s: 0.0001, r: 0.4, peak: gain }, 0.3);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.8);
  }
}
