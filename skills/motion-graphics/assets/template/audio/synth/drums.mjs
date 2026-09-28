// Drums and percussion, synthesised. Every voice: (t, opts) with t in seconds. Common opts: vel (loudness, 1 = normal),
// pan (-1..1), bus (default 'drums'), verb / delay (per-hit sends). The character options change the timbre, so two
// projects that both "use a kick" can still sound nothing alike — pick them per genre (see references/genre-cards.md).
import { SR, TAU, ctx, writer, trigger, at, noise, rand, svf, pulse, drive, clamp, lerp, hz } from './core.mjs';

/**
 * Kick drum: a sine with a pitch sweep, a click, saturation.
 * type presets: 'punch' (house/pop), 'deep' (deep/tech house), 'hard' (phonk/hardstyle hits), 'soft' (lo-fi, acoustic
 * pop), '808' (trap/phonk thump — pair with bass808 for the long tail), 'boom' (cinematic), 'tight' (dnb/breaks).
 * Overrides: tune (Hz of the body, or a note: 'A1'), sweep (Hz added at the start), decay (s), click (0..1), drive
 * (1..6), len (s).
 * Registers a sidechain trigger (duck: false to skip).
 */
export function kick(t, o = {}) {
  const P = {
    punch: { tune: 50, sweep: 190, speed: 42, decay: 0.2, click: 0.3, drive: 2.2, len: 0.42 },
    deep: { tune: 46, sweep: 110, speed: 30, decay: 0.3, click: 0.15, drive: 1.6, len: 0.55 },
    hard: { tune: 55, sweep: 260, speed: 32, decay: 0.24, click: 0.45, drive: 5, len: 0.5 },
    soft: { tune: 56, sweep: 70, speed: 38, decay: 0.14, click: 0.05, drive: 1.3, len: 0.32 },
    808: { tune: 44, sweep: 90, speed: 24, decay: 0.55, click: 0.12, drive: 1.8, len: 0.9 },
    boom: { tune: 36, sweep: 120, speed: 9, decay: 0.9, click: 0.2, drive: 2.4, len: 1.8 },
    tight: { tune: 58, sweep: 220, speed: 55, decay: 0.11, click: 0.5, drive: 2.6, len: 0.3 },
  }[o.type || 'punch'];
  const { sweep, speed, decay, click, drive: dr, len } = { ...P, ...o };
  const tune = typeof o.tune === 'string' ? hz(o.tune) : (o.tune ?? P.tune);
  const vel = o.vel ?? 1;
  if (o.duck !== false) trigger(o.key || 'kick', t, vel);
  const w = writer(o.bus || 'drums', { pan: o.pan, verb: o.verb, delay: o.delay, gain: vel });
  const i0 = at(t);
  const n = Math.floor(len * SR);
  const hp = svf();
  const lp = svf();
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    const f = tune + sweep * Math.exp(-s * speed) + sweep * 0.28 * Math.exp(-s * 9);
    ph += (TAU * f) / SR;
    const amp = (s < 0.002 ? s / 0.002 : 1) * Math.exp(-s / decay) * (s > len - 0.02 ? (len - s) / 0.02 : 1);
    let v = Math.sin(ph) * amp;
    v += hp(noise(), 3500, 0.7).hp * Math.exp(-s * 480) * click;
    if (o.type === 'soft') v = lp(v, 2600, 0.7).lp;
    v = drive(v, dr);
    w(i0 + k, v);
  }
}

/**
 * Snare: a tuned body plus band-passed noise. type: 'tight' (pop/house), 'fat' (hip-hop, rock-ish), 'trap' (bright,
 * crisp), 'lofi' (dull, dusty), 'gated' (80s: big and cut short — synthwave). Overrides: tone (Hz or a note), snap (noise 0..2),
 * decay (s), bright (Hz of the noise band).
 */
export function snare(t, o = {}) {
  const P = {
    tight: { tone: 190, snap: 1.3, decay: 0.16, bright: 2600, len: 0.22 },
    fat: { tone: 165, snap: 1.1, decay: 0.26, bright: 2100, len: 0.35 },
    trap: { tone: 210, snap: 1.6, decay: 0.14, bright: 4200, len: 0.2 },
    lofi: { tone: 180, snap: 0.9, decay: 0.18, bright: 1600, len: 0.24 },
    gated: { tone: 175, snap: 1.5, decay: 0.5, bright: 2400, len: 0.3 },
  }[o.type || 'tight'];
  const { snap, decay, bright, len } = { ...P, ...o };
  const tone = typeof o.tone === 'string' ? hz(o.tone) : (o.tone ?? P.tone);
  const vel = o.vel ?? 1;
  const w = writer(o.bus || 'drums', { pan: o.pan, verb: o.verb ?? (o.type === 'gated' ? 0.6 : 0.2), delay: o.delay, gain: vel });
  const i0 = at(t);
  const n = Math.floor(len * SR);
  const f = svf();
  const hp = svf();
  const lp = svf();
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    ph += (TAU * (tone + 70 * Math.exp(-s * 40))) / SR;
    const body = Math.sin(ph) * Math.exp(-s * 30) * 0.5;
    let nz = f(noise(), bright, 0.8).bp * 1.3 + hp(noise(), 6000, 0.7).hp * 0.35;
    nz *= Math.exp(-s / (decay * 0.55)) * snap;
    let v = body + nz;
    if (o.type === 'lofi') v = lp(v, 3200, 0.7).lp;
    const gateEnv = o.type === 'gated' ? (s > len - 0.03 ? (len - s) / 0.03 : 1) : 1;
    w(i0 + k, drive(v, 1.4) * gateEnv);
  }
}

/** Hand clap: four noise bursts and a tail, a little body. Overrides: spread (s between bursts), decay, tone (Hz). */
export function clap(t, o = {}) {
  const vel = o.vel ?? 1;
  const w = writer(o.bus || 'drums', { pan: o.pan, verb: o.verb ?? 0.45, delay: o.delay, gain: vel });
  const spread = o.spread ?? 0.009;
  const tone = o.tone ?? 1800;
  const tail = o.decay ?? 0.07;
  const i0 = at(t);
  const n = Math.floor((0.2 + tail * 3) * SR);
  const fl = svf(); const fr = svf(); const body = svf();
  const bursts = [0, spread, spread * 1.9, spread * 3];
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    let env = 0;
    for (let b = 0; b < bursts.length; b++) {
      const bt = bursts[b];
      if (s >= bt) env += b === 3 ? Math.exp(-(s - bt) / tail) * 1.1 : Math.exp(-(s - bt) * 150) * 0.85;
    }
    ph += (TAU * (210 + 80 * Math.exp(-s * 50))) / SR;
    const tn = Math.sin(ph) * Math.exp(-s * 30) * 0.2 + body(noise(), 4200, 0.8).hp * Math.exp(-s * 45) * 0.3;
    const l = Math.tanh((fl(noise(), tone, 1).bp * env * 1.7 + tn) * 1.6);
    const r = Math.tanh((fr(noise(), tone * 0.92, 1).bp * env * 1.7 + tn) * 1.6);
    w(i0 + k, l, r);
  }
}

/** Rimshot / side-stick: a short woody knock. */
export function rim(t, o = {}) {
  const w = writer(o.bus || 'drums', { pan: o.pan, verb: o.verb ?? 0.2, delay: o.delay, gain: o.vel ?? 1 });
  const i0 = at(t);
  const n = Math.floor(0.08 * SR);
  const bp = svf(); const bp2 = svf();
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    const x = noise() * Math.exp(-s * 900) * 4;
    const v = bp(x, o.tune ?? 1700, 8).bp + bp2(x, (o.tune ?? 1700) * 0.47, 6).bp * 0.6;
    w(i0 + k, drive(v * 1.6, 1.5));
  }
}

/** Finger snap: a bright, dry crack with a short room. */
export function snap(t, o = {}) {
  const w = writer(o.bus || 'drums', { pan: o.pan, verb: o.verb ?? 0.35, delay: o.delay, gain: o.vel ?? 1 });
  const i0 = at(t);
  const n = Math.floor(0.12 * SR);
  const bp = svf();
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    w(i0 + k, bp(noise(), 2400, 2.2).bp * (s < 0.0015 ? s / 0.0015 : 1) * Math.exp(-s * 70) * 1.3);
  }
}

// TR-808 hat oscillators (Hz): six detuned squares summed give the metallic ring that filtered noise lacks.
const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800];
/**
 * Hi-hat. open: long ring. tone: pitch multiplier of the metal (0.8 dark … 1.3 bright). decay (s). metal: 0 = pure
 * noise (soft, lo-fi) … 1 = 808 metal. pan. Use vel for accents; `choke` is implicit: an open hat is short enough.
 */
export function hat(t, o = {}) {
  const open = !!o.open;
  const decay = o.decay ?? (open ? 0.12 : 0.018);
  const len = Math.min(1.2, decay * 6 + 0.01);
  const metal = o.metal ?? 0.8;
  let tone = o.tone ?? 1;
  if (!(tone >= 0.3 && tone <= 3)) { // a value in Hz would put the filters past Nyquist
    if (!hat.warned) console.warn(`hat(): tone ${tone} is out of range — it is a multiplier (0.8 dark … 1.3 bright), not Hz; using 1`);
    hat.warned = true;
    tone = 1;
  }
  const w = writer(o.bus || 'drums', { pan: o.pan, verb: o.verb, delay: o.delay, gain: o.vel ?? 1 });
  const i0 = at(t);
  const n = Math.floor(len * SR);
  const bp = svf(); const hp = svf();
  const ph = HAT_F.map(() => rand());
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    let m = 0;
    for (let j = 0; j < 6; j++) { ph[j] += (HAT_F[j] * 1.7 * tone) / SR; if (ph[j] >= 1) ph[j] -= 1; m += ph[j] < 0.5 ? 1 : -1; }
    const src = ((m / 6) * metal + noise() * (1 - metal * 0.75)) / (0.6 + 0.8 * (1 - metal)); // same level for any metal
    const env = (s < 0.0008 ? s / 0.0008 : 1) * Math.exp(-s / decay);
    w(i0 + k, hp(bp(src, 10200 * Math.sqrt(tone), 1.1).bp, 7400 * tone, 0.8).hp * env * 2.4);
  }
}

/** Ride cymbal: a longer, pingy metal. */
export function ride(t, o = {}) {
  hat(t, { decay: 0.35, tone: 0.82, metal: 0.95, verb: 0.15, ...o, open: true });
}

/** Crash: wide noise wash with a metallic edge. dur (s) is the audible length. */
export function crash(t, o = {}) {
  const dur = o.dur ?? 2.2;
  const w = writer(o.bus || 'drums', { verb: o.verb ?? 0.3, delay: o.delay, gain: o.vel ?? 1 });
  const i0 = at(t);
  const n = Math.floor(dur * SR);
  const hl = svf(); const hr = svf();
  const ph = HAT_F.map(() => rand());
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    let m = 0;
    for (let j = 0; j < 6; j++) { ph[j] += (HAT_F[j] * 2.3) / SR; if (ph[j] >= 1) ph[j] -= 1; m += ph[j] < 0.5 ? 1 : -1; }
    const env = (s < 0.003 ? s / 0.003 : 1) * Math.exp(-s * (4.4 / dur)) * (s > dur - 0.05 ? (dur - s) / 0.05 : 1);
    w(i0 + k, hl(noise() + m * 0.05, 5200, 0.6).hp * env, hr(noise() + m * 0.05, 5000, 0.6).hp * env);
  }
}

/** Shaker: band-passed noise with a soft attack; alternate vel for the push-pull feel. */
export function shaker(t, o = {}) {
  const w = writer(o.bus || 'drums', { pan: o.pan ?? 0.25, verb: o.verb, delay: o.delay, gain: o.vel ?? 1 });
  const i0 = at(t);
  const n = Math.floor(0.09 * SR);
  const bp = svf();
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    const env = (s < 0.012 ? s / 0.012 : 1) * Math.exp(-(s > 0.012 ? s - 0.012 : 0) * 45);
    w(i0 + k, bp(noise(), o.tone ?? 7500, 1.4).bp * env * 0.9);
  }
}

/** Tom / conga / bongo: a pitched membrane. note: pitch (e.g. 'A2' tom, 'D4' conga), slap: noise (0..1), decay (s). */
export function tom(t, note, o = {}) {
  const base = hz(note);
  const w = writer(o.bus || 'drums', { pan: o.pan, verb: o.verb ?? 0.25, delay: o.delay, gain: o.vel ?? 1 });
  const decay = o.decay ?? 0.22;
  const i0 = at(t);
  const n = Math.floor((decay * 5 + 0.02) * SR);
  const bp = svf();
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    ph += (TAU * base * (1 + 0.45 * Math.exp(-s * 30))) / SR;
    const v = Math.sin(ph) * Math.exp(-s / decay) + bp(noise(), base * 6, 2).bp * Math.exp(-s * 120) * (o.slap ?? 0.4);
    w(i0 + k, drive(v * (s < 0.001 ? s / 0.001 : 1), 1.3));
  }
}
export const conga = (t, note, o = {}) => tom(t, note, { decay: 0.12, slap: 0.7, ...o });

/** Clave / woodblock: a resonant wooden click. note: 'C6'-ish. */
export function clave(t, note = 88, o = {}) {
  const f = hz(note);
  const w = writer(o.bus || 'drums', { pan: o.pan, verb: o.verb ?? 0.3, delay: o.delay, gain: o.vel ?? 1 });
  const i0 = at(t);
  const n = Math.floor(0.12 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    ph += (TAU * f) / SR;
    w(i0 + k, Math.sin(ph) * (s < 0.0008 ? s / 0.0008 : 1) * Math.exp(-s * (o.decay ? 1 / o.decay : 45)) * 0.9);
  }
}

/**
 * TR-808 cowbell, pitched: two pulses at 1 : 1.4815 through a band-pass, two-stage decay, a release tail. The phonk
 * lead voice when played as a riff. note, o: dur, cut (Hz), duty, bus (default 'lead').
 */
export function cowbell(t, note, o = {}) {
  const f = hz(note);
  const dur = o.dur ?? 0.34;
  const w = writer(o.bus || 'lead', { pan: o.pan, verb: o.verb ?? 0.12, delay: o.delay ?? 0.2, gain: o.vel ?? 1 });
  const i0 = at(t);
  const n = Math.floor(dur * SR);
  const o1 = pulse(); const o2 = pulse();
  const bp = svf(); const lp = svf();
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    const env = (s < 0.0006 ? s / 0.0006 : 1) * (0.62 * Math.exp(-s * 70) + 0.38 * Math.exp(-s * 9)) * (s > dur - 0.02 ? (dur - s) / 0.02 : 1);
    const raw = o1(f, o.duty ?? 0.5) * 0.55 + o2(f * 1.4815, o.duty ?? 0.5) * 0.45;
    const v = raw * 0.35 + bp(raw, f * 4.4, 1.3).bp * 1.25;
    w(i0 + k, lp(Math.tanh(v * 1.8), o.cut ?? 9000, 0.8).lp * env);
  }
}

/**
 * Roll: calls fn(t, vel, i) with the step shrinking from `from` to `to` beats (1/4 = 16ths, 1/8 = 32nds) and the
 * velocity rising — snare builds, trap hat rolls, tom fills. curve > 1 keeps it sparse longer.
 */
export function roll(t0, t1, fn, { from = 1 / 4, to = 1 / 16, vel0 = 0.3, vel1 = 1, curve = 1.5 } = {}) {
  const b = 60 / ctx.bpm;
  let t = t0;
  let i = 0;
  while (t < t1 - 1e-6) {
    const p = clamp((t - t0) / (t1 - t0));
    fn(t, lerp(vel0, vel1, p), i++);
    t += lerp(from, to, Math.pow(p, curve)) * b;
  }
}
