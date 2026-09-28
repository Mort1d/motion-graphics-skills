// Core of the synth: the song context (length, tempo, seeded randomness), buses, the voice writer, oscillators,
// filters, shapers and small DSP helpers. Everything renders offline into Float32 buffers at 48 kHz, deterministically.
export const SR = 48000;
export const TAU = Math.PI * 2;

export const ctx = { len: 0, duration: 0, bpm: 120, seed: 1, buses: new Map(), triggers: new Map(), events: [], master: null };

/** Seeded PRNG (mulberry32): the same seed gives the same track, bit for bit. */
export function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
let R = rng(1);
export const rand = () => R();
export const noise = () => R() * 2 - 1;
/** Random value in [a, b) from the song's seeded generator. */
export const between = (a, b) => a + (b - a) * R();

/**
 * Starts a song. duration: seconds (make it the video's length; the tail rings out inside it), bpm: the grid of
 * js/timeline.mjs, seed: changes every random choice (humanize, noise colour, detune phases) at once.
 */
export function init({ duration, bpm = 120, seed = 1 }) {
  if (!(duration > 0)) throw new Error('init({ duration }) needs the length of the video in seconds');
  ctx.duration = duration;
  ctx.len = Math.ceil(duration * SR);
  ctx.bpm = bpm;
  ctx.seed = seed;
  ctx.buses = new Map();
  ctx.triggers = new Map();
  ctx.events = [];
  ctx.master = null;
  R = rng(seed);
  return ctx;
}

export const beat = () => 60 / ctx.bpm;
/** n beats → seconds (quarter notes at the song's bpm). */
export const beats = (n) => n * beat();
/** n bars of 4/4 → seconds. */
export const bars = (n) => n * 4 * beat();

// ---- units ---------------------------------------------------------------------------------------------------------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const dbToGain = (d) => Math.pow(10, d / 20);
export const gainToDb = (g) => (g > 0 ? 20 * Math.log10(g) : -Infinity);
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
/** 'C#3' / 'Eb4' / 'a2' / 60 → MIDI number (C4 = 60). */
export function note(n) {
  if (typeof n === 'number') return n;
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(n).trim());
  if (!m) throw new Error(`bad note "${n}" (use e.g. C3, F#4, Bb2 or a MIDI number)`);
  return NOTE[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (Number(m[3]) + 1);
}
export const hz = (n) => mtof(note(n));

/** Equal-power pan: -1 left … 0 centre … 1 right → [gainL, gainR]. */
export function panLR(p = 0) {
  const a = (clamp(p, -1, 1) + 1) * Math.PI / 4;
  return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2];
}

// ---- buses and voice output ---------------------------------------------------------------------------------------------
/**
 * Gets (and optionally configures) a bus. Every voice writes into one; the mixer (mix.mjs) processes and sums them.
 * opts (all optional): gain (dB), pan, width (0 = mono … 1 … 2 = wide), hp / lp (Hz), eq [{ f, g (dB), q, type:
 * 'peak'|'low'|'high' }], drive (1 = off … 4 = hot), crush { bits, rate }, chorus { rate, depth, mix }, comp
 * { threshold (dB), ratio, attack, release, makeup }, duck (0..1 depth against the kick, or [{ from, depth, attack,
 * release }]), verb (reverb send 0..1), delay (delay send 0..1), mute.
 */
export function bus(name, opts) {
  let b = ctx.buses.get(name);
  if (!b) {
    if (!ctx.len) throw new Error('call init({ duration, bpm }) before writing sound');
    b = { name, L: new Float32Array(ctx.len), R: new Float32Array(ctx.len), opts: { ...(DEFAULTS[name] || {}) }, auto: {} };
    ctx.buses.set(name, b);
  }
  if (opts) Object.assign(b.opts, opts);
  return b;
}
// Sensible starting points; override with bus(name, {...}).
const DEFAULTS = {
  drums: { gain: -2 },
  bass: { gain: -4, duck: 0.5 },
  music: { gain: -4, duck: 0.35, verb: 0.15 },
  lead: { gain: -5, duck: 0.25, verb: 0.2, delay: 0.12 },
  fx: { gain: -4, verb: 0.15 },
  verb: { gain: 0 },
  delay: { gain: 0 },
};

/**
 * Returns write(i, l, r) that adds a stereo sample at index i into bus `name`. Per-voice sends (verb, delay) go to the
 * bus's own send buffers, so they follow the bus's gain and ducking; dry: 0 writes only the sends (a reverb-only layer).
 * Indices outside the song are ignored.
 */
export function writer(name, { pan = 0, verb = 0, delay = 0, gain = 1, dry = 1 } = {}) {
  const b = bus(name);
  const [pl, pr] = panLR(pan);
  const gl = pl * gain;
  const gr = pr * gain;
  if (verb && !b.VL) { b.VL = new Float32Array(ctx.len); b.VR = new Float32Array(ctx.len); }
  if (delay && !b.DL) { b.DL = new Float32Array(ctx.len); b.DR = new Float32Array(ctx.len); }
  const len = ctx.len;
  return (i, l, r = l) => {
    if (i < 0 || i >= len) return;
    const L = l * gl;
    const Rr = r * gr;
    b.L[i] += L * dry;
    b.R[i] += Rr * dry;
    if (verb) { b.VL[i] += L * verb; b.VR[i] += Rr * verb; }
    if (delay) { b.DL[i] += L * delay; b.DR[i] += Rr * delay; }
  };
}

/** Registers a sidechain trigger (kicks call trigger('kick', t) themselves). Buses duck from these. */
export function trigger(key, t, amount = 1) {
  if (!ctx.triggers.has(key)) ctx.triggers.set(key, []);
  ctx.triggers.get(key).push([t, amount]);
}

/** Sample index of time t (seconds). */
export const at = (t) => Math.floor(t * SR);

// ---- envelopes ----------------------------------------------------------------------------------------------------------
/** Linear attack, exponential decay (time constant tau, seconds): the workhorse percussive envelope. */
export const adExp = (s, attack, tau) => (s < attack ? s / attack : Math.exp(-(s - attack) / tau));
/** Attack / hold / release gate for sustained notes: ramps avoid clicks. */
export function gate(s, dur, attack = 0.005, release = 0.05) {
  if (s < 0) return 0;
  const a = attack > 0 ? Math.min(1, s / attack) : 1;
  const r = s > dur ? Math.max(0, 1 - (s - dur) / Math.max(1e-4, release)) : 1;
  return a * r;
}
/** Smooth 0 → 1 → 0 bump over p in [0, 1] (whoosh-like swells). */
export const swell = (p, power = 1.6) => Math.pow(Math.max(0, Math.sin(Math.PI * clamp(p))), power);

// ---- oscillators (phase kept in a closure; call once per sample with the frequency) ---------------------------------------
function blep(ph, dt) {
  if (ph < dt) { const x = ph / dt; return x + x - x * x - 1; }
  if (ph > 1 - dt) { const x = (ph - 1) / dt; return x * x + x + x + 1; }
  return 0;
}
/** Band-limited saw (polyBLEP). */
export function saw(phase = R()) {
  let ph = phase;
  return (f) => { const dt = Math.min(0.49, f / SR); ph += dt; if (ph >= 1) ph -= 1; return 2 * ph - 1 - blep(ph, dt); };
}
/** Band-limited pulse; width 0.5 = square, 0.25 / 0.125 = the thin NES-like pulses. */
export function pulse(width = 0.5, phase = R()) {
  let ph = phase;
  return (f, w = width) => {
    const dt = Math.min(0.49, f / SR);
    ph += dt;
    if (ph >= 1) ph -= 1;
    let v = ph < w ? 1 : -1;
    v += blep(ph, dt);
    v -= blep((ph + 1 - w) % 1, dt);
    return v;
  };
}
export const square = (phase) => pulse(0.5, phase);
/** Triangle (integrated square, leaky) — soft, flute / chip-bass colour. */
export function tri(phase = R()) {
  const sq = pulse(0.5, phase);
  let y = 0;
  return (f) => { y += (4 * f / SR) * sq(f); y *= 0.9995; return y; };
}
export function sine(phase = R()) {
  let ph = phase;
  return (f) => { ph += f / SR; if (ph >= 1) ph -= 1; return Math.sin(TAU * ph); };
}
/** Pink-ish noise (Paul Kellet's economy filter): warmer than white for textures, rain, vinyl beds. */
export function pink() {
  let b0 = 0; let b1 = 0; let b2 = 0;
  return () => {
    const w = noise();
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    return (b0 + b1 + b2 + w * 0.1848) * 0.25;
  };
}
/** Supersaw: `voices` saws spread over ±detune semitones, each with its own pan. Returns (f) → [l, r]. */
export function supersawOsc(voices = 7, detune = 0.18, width = 0.9) {
  const vs = Array.from({ length: voices }, (_, k) => {
    const x = voices === 1 ? 0 : (k / (voices - 1)) * 2 - 1;
    return { o: saw(), r: Math.pow(2, (x * detune) / 12), p: panLR(x * width), g: k === (voices >> 1) ? 1 : 0.8 };
  });
  const norm = 1 / Math.sqrt(voices);
  return (f) => {
    let l = 0; let r = 0;
    for (const v of vs) { const s = v.o(f * v.r) * v.g; l += s * v.p[0]; r += s * v.p[1]; }
    return [l * norm, r * norm];
  };
}

// ---- filters ----------------------------------------------------------------------------------------------------------------
/**
 * Zero-delay-feedback state-variable filter (Simper / TPT): stable at any cutoff, modulate it per sample.
 * Returns (x, fc, q) → { lp, bp, hp, notch }.
 */
export function svf() {
  let ic1 = 0; let ic2 = 0;
  const out = { lp: 0, bp: 0, hp: 0, notch: 0 };
  return (x, fc, q = 0.707) => {
    const g = Math.tan(Math.PI * clamp(fc, 10, SR * 0.45) / SR);
    const k = 1 / Math.max(0.05, q);
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    out.lp = v2; out.bp = v1; out.hp = x - k * v1 - v2; out.notch = x - k * v1;
    return out;
  };
}
export const lowpass = () => { const f = svf(); return (x, fc, q) => f(x, fc, q).lp; };
export const highpass = () => { const f = svf(); return (x, fc, q) => f(x, fc, q).hp; };
export const bandpass = () => { const f = svf(); return (x, fc, q) => f(x, fc, q).bp; };

/** RBJ biquad with fixed coefficients (EQ bands): type 'peak' | 'low' (shelf) | 'high' (shelf) | 'lp' | 'hp'. */
export function biquad(type, f, gainDb = 0, q = 0.707) {
  const A = Math.pow(10, gainDb / 40);
  const w = (TAU * clamp(f, 10, SR * 0.45)) / SR;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const al = sw / (2 * q);
  let b0; let b1; let b2; let a0; let a1; let a2;
  if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  else if (type === 'low' || type === 'high') {
    const s = type === 'low' ? 1 : -1;
    const sq = 2 * Math.sqrt(A) * al;
    b0 = A * ((A + 1) - s * (A - 1) * cw + sq);
    b1 = s * 2 * A * ((A - 1) - s * (A + 1) * cw);
    b2 = A * ((A + 1) - s * (A - 1) * cw - sq);
    a0 = (A + 1) + s * (A - 1) * cw + sq;
    a1 = -s * 2 * ((A - 1) + s * (A + 1) * cw);
    a2 = (A + 1) + s * (A - 1) * cw - sq;
  } else if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  const B0 = b0 / a0; const B1 = b1 / a0; const B2 = b2 / a0; const A1 = a1 / a0; const A2 = a2 / a0;
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  return (x) => { const y = B0 * x + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
/** One-pole smoother / low-pass (tone controls, parameter smoothing). */
export function onePole(fc) {
  const a = Math.exp((-TAU * fc) / SR);
  let y = 0;
  return (x) => { y = x + (y - x) * a; return y; };
}
/** DC blocker (after asymmetric distortion). */
export function dcBlock() {
  let x1 = 0; let y1 = 0;
  return (x) => { const y = x - x1 + 0.995 * y1; x1 = x; y1 = y; return y; };
}

// ---- shapers -------------------------------------------------------------------------------------------------------------------
/** Saturation normalised so drive changes colour, not level (drive 1 ≈ clean, 3 = warm, 6 = dirty). */
export const drive = (x, amount = 2) => (amount <= 1 ? x : Math.tanh(x * amount) / Math.tanh(amount));
/** Wavefolder for aggressive harmonics (0 = off … 1 = heavy). */
export const fold = (x, amount = 0.5) => Math.sin(x * (1 + amount * 4) * Math.PI / 2);
/** Bit and rate reduction for lo-fi / 8-bit grit. Returns (x) → y. */
export function crusher(bits = 8, rateDiv = 4) {
  const q = Math.pow(2, bits - 1);
  let n = 0; let hold = 0;
  return (x) => { if (n++ % Math.max(1, Math.round(rateDiv)) === 0) hold = Math.round(x * q) / q; return hold; };
}

// ---- delay line -------------------------------------------------------------------------------------------------------------------
/** Fractional delay line: write(x) then read(delaySamples) with linear interpolation. */
export function delayLine(maxSeconds) {
  const n = Math.ceil(maxSeconds * SR) + 4;
  const buf = new Float32Array(n);
  let w = 0;
  return {
    write(x) { buf[w] = x; w = (w + 1) % n; },
    read(d) {
      const p = w - 1 - clamp(d, 0, n - 3);
      const i = Math.floor(p);
      const f = p - i;
      const a = buf[((i % n) + n) % n];
      const b = buf[(((i + 1) % n) + n) % n];
      return a + (b - a) * f;
    },
  };
}
