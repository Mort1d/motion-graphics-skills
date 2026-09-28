// Sound design: transitions (whoosh, riser, downlifter, reverse cymbal), hits (impact, boom, braam, sub drop), UI and
// foley (tick, click, pop, blip, ding, key, shutter, coin, buzz, paper, glitch, zap...) plus two raw builders — noiseHit()
// and toneSweep() — for the one sound that belongs to THIS brand's world (an engine, a coffee machine, a till, a
// camera...). Default bus 'fx'. Pan follows the picture: something entering from the left starts at pan -1.
import { SR, TAU, writer, at, noise, rand, svf, saw, pulse, drive, clamp, lerp, hz, note, swell, crusher, panLR } from './core.mjs';
import { bell } from './tonal.mjs';
import { kick } from './drums.mjs';

/**
 * Whoosh: band-passed noise sweeping f0 → f1 while panning pan[0] → pan[1]. shape: 'swell' (passes by),
 * 'in' (builds into a hit at the end), 'out' (starts on the hit and fades). Match dur to the motion on screen.
 */
export function whoosh(t, dur, o = {}) {
  const w0 = writer(o.bus || 'fx', { verb: o.verb ?? 0.25, delay: o.delay, gain: o.vel ?? 1 });
  const f = svf();
  const [p0, p1] = o.pan ?? [-0.7, 0.7];
  const f0 = o.f0 ?? 300; const f1 = o.f1 ?? 4000;
  const shape = o.shape || 'swell';
  const i0 = at(t);
  const n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const p = k / n;
    const env = shape === 'swell' ? swell(p, 1.5) : shape === 'in' ? Math.pow(p, 2.2) * (p > 0.96 ? (1 - p) / 0.04 : 1) : Math.pow(1 - p, 2) * Math.min(1, p / 0.03);
    const v = f(noise(), f0 * Math.pow(f1 / f0, p), o.q ?? 1.3).bp * env * 2;
    const [pl, pr] = panLR(lerp(p0, p1, p));
    w0(i0 + k, v * pl, v * pr);
  }
}
/** Short, bright swish for UI moves, card flips, text swipes (0.12–0.25 s). */
export const swish = (t, o = {}) => whoosh(t, o.dur ?? 0.18, { f0: 1500, f1: 7000, q: 1.8, verb: 0.1, ...o });

/**
 * Riser into a drop / reveal: noise sweep + optional rising saw (tone) + tremolo widening. type 'noise' | 'tone'
 * (default: both) | 'shepard' (endless rising tone stack — tension).
 */
export function riser(t0, t1, o = {}) {
  const w = writer(o.bus || 'fx', { verb: o.verb ?? 0.2, delay: o.delay, gain: o.vel ?? 1 });
  const dur = t1 - t0;
  const i0 = at(t0);
  const n = Math.floor(dur * SR);
  const f0 = o.f0 ?? 380; const f1 = o.f1 ?? 9000;
  const nf = svf(); const lp = svf(); const osc = saw();
  const type = o.type || 'both';
  const sh = type === 'shepard' ? Array.from({ length: 6 }, (_, j) => ({ j, ph: rand() })) : null;
  for (let k = 0; k < n; k++) {
    const p = k / n;
    const env = Math.pow(p, o.curve ?? 2.2);
    let v = 0;
    if (type !== 'tone' && type !== 'shepard') v += nf(noise(), f0 * Math.pow(f1 / f0, p), 1.6).bp * 1.6;
    if (type === 'tone' || type === 'both') v += lp(osc(110 * Math.pow(8, p)), 600 + 6000 * p, 1).lp * 0.25;
    if (sh) {
      for (const s of sh) {
        const oct = (s.j + p * 2) % 6; // two octaves of rise over the riser
        const fr = 55 * Math.pow(2, oct);
        s.ph = (s.ph + fr / SR) % 1;
        v += Math.sin(TAU * s.ph) * Math.exp(-Math.pow((oct - 3) / 1.4, 2)) * 0.75;
      }
    }
    v *= env;
    const wv = 0.3 * Math.sin(TAU * (2 + 10 * p) * p);
    w(i0 + k, v * (1 - wv) * 0.5, v * (1 + wv) * 0.5);
  }
}

/** Downlifter: the reverse of a riser, right after a hit (noise and pitch falling away). */
export function downlifter(t, dur, o = {}) {
  const w = writer(o.bus || 'fx', { verb: o.verb ?? 0.3, gain: o.vel ?? 1 });
  const nf = svf();
  let ph = 0;
  const i0 = at(t);
  const n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const p = k / n;
    ph += (TAU * (900 * Math.pow(0.08, p))) / SR;
    const v = (nf(noise(), 6000 * Math.pow(0.06, p), 1.2).bp * 1.4 + Math.sin(ph) * 0.2) * Math.pow(1 - p, 1.8) * Math.min(1, p / 0.01);
    w(i0 + k, v);
  }
}

/** Reverse cymbal ending exactly at tEnd (suck-in before a drop). */
export function reverseCymbal(tEnd, dur, o = {}) {
  const w = writer(o.bus || 'fx', { gain: o.vel ?? 1 });
  const hl = svf(); const hr = svf();
  const i0 = at(tEnd - dur);
  const n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const p = k / n;
    const env = Math.pow(p, 3) * (p > 0.985 ? (1 - p) / 0.015 : 1);
    w(i0 + k, hl(noise(), 5000 + 3000 * p, 0.7).hp * env, hr(noise(), 5200 + 3000 * p, 0.7).hp * env);
  }
}

/**
 * Impact: sub pitch-drop + low-passed air + crack, saturated — for slams, logo hits, drops.
 * o: sub (note of the sub, default 'C1'), air (0..1.5), crack (0..1.5), decay (1/s), trig (duck key, default 'hit').
 */
export function impact(t, o = {}) {
  const vel = o.vel ?? 1;
  const w = writer(o.bus || 'fx', { gain: 1 });
  const V = writer(o.bus || 'fx', { gain: 1, dry: 0, verb: 1 }); // air + crack also feed the reverb
  const f = svf(); const g2 = svf();
  const fs = hz(o.sub ?? 'C1');
  const dec = o.decay ?? 2.2;
  const air = o.air ?? 1; const crack = o.crack ?? 1;
  const i0 = at(t);
  let ph = 0;
  for (let k = 0; k < 2.6 * SR; k++) {
    const s = k / SR;
    ph += (TAU * (fs + 70 * Math.exp(-s * 16))) / SR;
    const s1 = Math.sin(ph) * Math.exp(-s * dec) * 0.95;
    const a = f(noise(), 700 + 5200 * Math.exp(-s * 5), 0.6).lp * Math.exp(-s * dec * 1.25) * 0.5 * air;
    const c = g2(noise(), 3000, 0.8).hp * Math.exp(-s * 40) * 0.55 * crack;
    w(i0 + k, Math.tanh((s1 + a + c) * vel * 1.3));
    V(i0 + k, (a + c) * 0.5 * vel);
  }
}

/** Boom / sub drop: a long sine falling from `from` Hz to `to` Hz (under logo slams and drops). */
export function boom(t, o = {}) {
  const dur = o.dur ?? 1.4;
  const w = writer(o.bus || 'fx', { gain: o.vel ?? 1 });
  const from = o.from ?? 85; const to = o.to ?? 30;
  let ph = 0;
  const i0 = at(t);
  for (let k = 0; k < dur * SR; k++) {
    const s = k / SR;
    ph += (TAU * (to + (from - to) * Math.exp(-s * (o.speed ?? 2.6)))) / SR;
    w(i0 + k, drive(Math.sin(ph), o.drive ?? 1.4) * Math.exp(-s * (3 / dur)) * (s < 0.01 ? s / 0.01 : 1) * 0.8);
  }
}

/** Braam: the trailer horn — detuned saws an octave apart, distorted, low-passed, slow bloom. */
export function braam(t, dur, o = {}) {
  const w = writer(o.bus || 'fx', { verb: o.verb ?? 0.35, gain: o.vel ?? 1 });
  const root = hz(o.note ?? 'C2');
  const vs = [0.5, 1, 1.004, 0.996, 2].map((r) => ({ o: saw(), f: root * r }));
  const fl = svf();
  const i0 = at(t);
  for (let k = 0; k < (dur + 0.8) * SR; k++) {
    const s = k / SR;
    let x = 0;
    for (const v of vs) x += v.o(v.f);
    const env = Math.min(1, s / 0.04) * (s < dur ? 1 - 0.3 * (s / dur) : 0.7 * Math.exp(-(s - dur) * 5));
    w(i0 + k, drive(fl(x * 0.35, 250 + 1400 * Math.min(1, s / 0.25) * (1 - 0.4 * clamp(s / dur)), 1.4).lp, 3) * env);
  }
}

// ---- UI / foley -------------------------------------------------------------------------------------------------------------
/** Tick: a tiny band-passed click (counters, cursors, split-flaps, typing). bright (Hz), dur, q. */
export function tick(t, o = {}) {
  const w = writer(o.bus || 'fx', { pan: o.pan, verb: o.verb, gain: o.vel ?? 1 });
  const f = svf();
  const bright = o.bright ?? 4200;
  const i0 = at(t);
  let ph = 0;
  for (let k = 0; k < (o.dur ?? 0.035) * SR; k++) {
    const s = k / SR;
    ph += (TAU * bright * 0.5) / SR;
    w(i0 + k, (f(noise(), bright, o.q ?? 4).bp * 0.9 + Math.sin(ph) * 0.16) * Math.exp(-s * 230));
  }
}
/** Mouse / button click: press + release. */
export function click(t, o = {}) {
  tick(t, { bright: 4200, ...o, vel: (o.vel ?? 1) * 0.6 });
  tick(t + 0.045, { bright: 3000, ...o, vel: (o.vel ?? 1) * 0.35 });
}
/** Mechanical key: a knock and a click (typing). */
export function key(t, o = {}) {
  tick(t, { bright: 3200 + rand() * 2400, dur: 0.02, q: 1.6, ...o, vel: (o.vel ?? 1) * (0.8 + 0.3 * rand()) });
  const w = writer(o.bus || 'fx', { pan: o.pan, gain: (o.vel ?? 1) * 0.3 });
  const i0 = at(t);
  let ph = 0;
  for (let k = 0; k < 0.04 * SR; k++) { const s = k / SR; ph += (TAU * 420) / SR; w(i0 + k, Math.sin(ph) * Math.exp(-s * 120)); }
}
/** Pop: a sine that bends up into its pitch — tuned to the key it is musical (items appearing, bubbles, likes). */
export function pop(t, n, o = {}) {
  const f = hz(n);
  const w = writer(o.bus || 'fx', { pan: o.pan, verb: o.verb ?? 0.25, gain: o.vel ?? 1 });
  const i0 = at(t);
  let ph = 0;
  for (let k = 0; k < 0.16 * SR; k++) {
    const s = k / SR;
    ph += (TAU * f * (0.55 + 0.45 * (1 - Math.exp(-s * 90)))) / SR;
    w(i0 + k, Math.sin(ph) * (s < 0.002 ? s / 0.002 : 1) * Math.exp(-s * 26));
  }
}
/** Blip: a short square note (8-bit confirmations, pixel UIs). */
export function blip(t, n, o = {}) {
  const f = hz(n);
  const w = writer(o.bus || 'fx', { pan: o.pan, verb: o.verb ?? 0.1, gain: o.vel ?? 1 });
  const osc = pulse(o.duty ?? 0.5);
  const lp = svf();
  const d = o.dur ?? 0.07;
  const i0 = at(t);
  for (let k = 0; k < (d + 0.01) * SR; k++) { const s = k / SR; w(i0 + k, lp(osc(f), 5000, 0.7).lp * (s < d ? 1 : 1 - (s - d) / 0.01) * 0.75); }
}
/** Notification ding: two quick FM bell notes (n2 defaults to a fifth up). */
export function ding(t, n, o = {}) {
  bell(t, n, { ratio: 3.5, index: 1.4, idec: 9, dur: 0.7, verb: 0.35, bus: 'fx', ...o, vel: (o.vel ?? 1) * 0.5 });
  bell(t + 0.085, o.n2 ?? note(n) + 7, { ratio: 3.5, index: 1.4, idec: 9, dur: 0.9, verb: 0.35, bus: 'fx', ...o, vel: (o.vel ?? 1) * 0.5 });
}
/** Success: a rising bell arpeggio plus a sparkle (order placed, payment passed, checkmark). root: note. */
export function success(t, root = 72, o = {}) {
  const r = note(root);
  [0, 4, 7, 12].forEach((iv, i) => bell(t + i * 0.055, r + iv, { ratio: 2, index: 1.3, idec: 7, dur: 1.2, verb: 0.55, pan: -0.45 + 0.3 * i, bus: 'fx', vel: (o.vel ?? 1) * 0.45 }));
  sparkle(t + 0.2, { vel: (o.vel ?? 1) * 0.5 });
}
/** Sparkle: a shower of tiny high ticks (shine, magic, new). */
export function sparkle(t, o = {}) {
  const n = o.count ?? 10;
  for (let k = 0; k < n; k++) tick(t + k * (o.spacing ?? 0.03), { bright: 7000 + k * 300, pan: (rand() - 0.5) * 1.4, vel: (o.vel ?? 1) * 0.35 * (1 - k / (n + 2)) });
}
/** Coin / till «ka-ching»: two metallic partials and a shimmer (prices, discounts, sales). */
export function coin(t, o = {}) {
  bell(t, 96, { ratio: 1.41, index: 2.2, idec: 5, dur: 0.9, verb: 0.4, pan: 0.2, bus: 'fx', vel: (o.vel ?? 1) * 0.3 });
  bell(t + 0.07, 100, { ratio: 1.41, index: 2.2, idec: 5, dur: 1.1, verb: 0.45, pan: -0.2, bus: 'fx', vel: (o.vel ?? 1) * 0.3 });
  noiseHit(t, 0.25, { hp: 9000, decay: 18, vel: (o.vel ?? 1) * 0.35 });
}
/** Camera shutter: two mechanical clicks 34 ms apart. */
export function shutter(t, o = {}) {
  noiseHit(t, 0.04, { bp: 3200, q: 2.5, decay: 160, vel: (o.vel ?? 1) * 0.85 });
  noiseHit(t + 0.034, 0.04, { bp: 1800, q: 2.5, decay: 160, vel: (o.vel ?? 1) * 0.65 });
}
/** Phone vibration: a rough 160 Hz motor with flutter. */
export function buzz(t, o = {}) {
  const w = writer(o.bus || 'fx', { pan: o.pan, gain: o.vel ?? 1 });
  const f = svf();
  const dur = o.dur ?? 0.26;
  let ph = 0;
  const i0 = at(t);
  for (let k = 0; k < dur * SR; k++) {
    const s = k / SR;
    ph += (TAU * (158 + 6 * Math.sin(TAU * 31 * s))) / SR;
    const env = (s < 0.01 ? s / 0.01 : 1) * (s > dur - 0.06 ? Math.max(0, (dur - s) / 0.06) : 1) * (0.75 + 0.25 * Math.sin(TAU * 18 * s));
    w(i0 + k, (Math.tanh(Math.sin(ph) * 3) + 0.3 * f(noise(), 900, 1).bp) * env * 0.7);
  }
}
/** Paper: a page flick / card / ticket / box flap — papery burst with a small thump. */
export function paper(t, o = {}) {
  const w = writer(o.bus || 'fx', { pan: o.pan, verb: o.verb ?? 0.2, gain: o.vel ?? 1 });
  const f = svf();
  const dur = o.dur ?? 0.16;
  let ph = 0;
  const i0 = at(t);
  for (let k = 0; k < dur * SR; k++) {
    const s = k / SR;
    const pp = f(noise(), 5200 - 3000 * (s / dur), 1.2).bp * Math.exp(-s * 28) * (s < 0.004 ? s / 0.004 : 1);
    ph += (TAU * (120 + 60 * Math.exp(-s * 40))) / SR;
    w(i0 + k, pp * 1.05 + Math.sin(ph) * Math.exp(-s * 35) * 0.5);
  }
}
/** Thud: something lands (a box, a phone on a table, a stamp). f0 = body pitch (Hz). */
export function thud(t, o = {}) {
  const w = writer(o.bus || 'fx', { gain: o.vel ?? 1 });
  const f = svf();
  let ph = 0;
  const f0 = o.f0 ?? 90;
  const i0 = at(t);
  for (let k = 0; k < 0.3 * SR; k++) {
    const s = k / SR;
    ph += (TAU * (f0 + 60 * Math.exp(-s * 30))) / SR;
    w(i0 + k, Math.sin(ph) * Math.exp(-s * 16) + f(noise(), 900, 0.8).lp * Math.exp(-s * 40) * 0.6);
  }
}
/** Glitch: bit-crushed sample-and-hold bursts with random pitch and a stereo flip (tech, AI, errors, cuts). */
export function glitch(t, dur, o = {}) {
  const w = writer(o.bus || 'fx', { gain: o.vel ?? 1 });
  const n = Math.floor(dur * SR);
  const i0 = at(t);
  let hold = 0; let hv = 0; let ph = 0; let f = 400;
  for (let k = 0; k < n; k++) {
    if (k % Math.floor(SR * 0.018) === 0) f = 120 + rand() * 1800;
    ph += (TAU * f) / SR;
    if (hold-- <= 0) { hv = Math.sign(Math.sin(ph)) * 0.5 + noise() * 0.5; hold = 6 + Math.floor(rand() * 3) * 6; }
    const g = (Math.floor(k / (SR * 0.009)) % 3) !== 1 ? 1 : 0.15;
    const v = (Math.round(hv * 6) / 6) * g * 0.85 * (1 - (k / n) * 0.3);
    w(i0 + k, v, -v * 0.8);
  }
}
/** Zap: laser-ish sine falling fast with a noise tail (sci-fi, gaming, energy). */
export function zap(t, o = {}) {
  const w = writer(o.bus || 'fx', { verb: o.verb ?? 0.4, gain: o.vel ?? 1 });
  const f = svf();
  let ph = 0;
  const i0 = at(t);
  for (let k = 0; k < 0.9 * SR; k++) {
    const s = k / SR;
    ph += (TAU * (2400 * Math.exp(-s * 6) + 180)) / SR;
    w(i0 + k, (Math.sin(ph) * 0.5 + f(noise(), 6000 * Math.exp(-s * 3) + 400, 0.8).lp * 0.8) * Math.exp(-s * 3.5));
  }
}
/** Boing: a spring wobble (cartoon, kids, playful bounces). */
export function boing(t, o = {}) {
  const w = writer(o.bus || 'fx', { verb: o.verb ?? 0.3, gain: o.vel ?? 1 });
  let ph = 0;
  const f0 = o.f ?? 520;
  const i0 = at(t);
  for (let k = 0; k < 0.45 * SR; k++) {
    const s = k / SR;
    ph += (TAU * f0 * (1 + 0.35 * Math.exp(-s * 7) * Math.sin(TAU * 11 * s))) / SR;
    w(i0 + k, Math.sin(ph) * Math.exp(-s * 7) * (s < 0.003 ? s / 0.003 : 1));
  }
}
/** Goo / bloop: a liquid pitch glide (drops, bubbles, squishy UI). */
export function goo(t, dur, o = {}) {
  const w = writer(o.bus || 'fx', { verb: o.verb ?? 0.3, gain: o.vel ?? 1 });
  const f0 = o.f0 ?? 260; const f1 = o.f1 ?? 640;
  let ph = 0;
  const i0 = at(t);
  const n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const p = k / n; const s = k / SR;
    ph += (TAU * f0 * Math.pow(f1 / f0, Math.pow(p, 0.6)) * (1 + 0.06 * Math.sin(TAU * 18 * s) * (1 - p))) / SR;
    w(i0 + k, (Math.sin(ph) + 0.25 * Math.sin(2 * ph)) * Math.sin(Math.PI * Math.min(1, p * 1.25)) * (p > 0.8 ? (1 - p) / 0.2 : 1));
  }
}
/** Heartbeat: lub-dub (tension, health, "feel it"). */
export function heartbeat(t, o = {}) {
  kick(t, { type: 'soft', tune: 46, vel: (o.vel ?? 1) * 0.55, duck: false, bus: o.bus || 'fx' });
  kick(t + 0.18, { type: 'soft', tune: 44, vel: (o.vel ?? 1) * 0.35, duck: false, bus: o.bus || 'fx' });
}
/** Error / declined buzz: two harsh squares with a falling tail. */
export function errorBuzz(t, o = {}) {
  toneSweep(t, o.dur ?? 0.2, { wave: 'square', from: 'D3', to: 'A2', vel: (o.vel ?? 1) * 1.0, cut: 2600, drive: 2.2, bend: 0.55 });
  toneSweep(t, o.dur ?? 0.2, { wave: 'pulse', from: 'G#3', to: 'D#3', vel: (o.vel ?? 1) * 0.8, cut: 2600, drive: 2.2, bend: 0.55 });
}

// ---- raw builders for brand-world sounds ---------------------------------------------------------------------------------------
/**
 * Filtered noise burst — the base of most foley. dur (s), o: bp (Hz) + q, or lp / hp (Hz); attack (s); decay (1/s,
 * exponential) ; sweepTo (Hz: filter glides there over the burst); pan; vel; verb. Sizzle, steam, air, spray, fabric,
 * water, sand, crowd... are all shaped noise.
 */
export function noiseHit(t, dur, o = {}) {
  const w = writer(o.bus || 'fx', { pan: o.pan, verb: o.verb, delay: o.delay, gain: o.vel ?? 1 });
  const f = svf();
  const i0 = at(t);
  const n = Math.floor(dur * SR);
  const fc0 = o.bp ?? o.lp ?? o.hp ?? 2000;
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    const p = k / n;
    const fc = o.sweepTo ? fc0 * Math.pow(o.sweepTo / fc0, p) : fc0;
    const r = f(o.pink ? noise() * 0.6 : noise(), fc, o.q ?? 0.9);
    const x = o.bp ? r.bp * 1.6 : o.hp ? r.hp : r.lp;
    const env = (o.attack ? Math.min(1, s / o.attack) : 1) * Math.exp(-s * (o.decay ?? 0)) * (p > 0.97 ? (1 - p) / 0.03 : 1);
    w(i0 + k, x * env);
  }
}
/**
 * Tone sweep — the base of electronic foley: wave ('sine'|'saw'|'square'|'pulse'), pitch from → to (notes or Hz via
 * {hz}), bend: where the glide happens (0 = from the start, 0.5 = second half), cut (Hz), drive, vibrato (Hz),
 * env: 'decay' | 'swell' | 'flat'. Engines, motors, servos, lasers, sirens, beeps.
 */
export function toneSweep(t, dur, o = {}) {
  const w = writer(o.bus || 'fx', { pan: o.pan, verb: o.verb, delay: o.delay, gain: o.vel ?? 1 });
  const osc = o.wave === 'saw' ? saw() : o.wave === 'square' ? pulse(0.5) : o.wave === 'pulse' ? pulse(0.3) : null;
  const lp = svf();
  const a = typeof o.from === 'object' ? o.from.hz : hz(o.from ?? 'A4');
  const z = typeof o.to === 'object' ? o.to.hz : hz(o.to ?? o.from ?? 'A4');
  const bend = o.bend ?? 0;
  const i0 = at(t);
  const n = Math.floor(dur * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const p = k / n; const s = k / SR;
    const q = clamp((p - bend) / Math.max(0.01, 1 - bend));
    const f = a * Math.pow(z / a, q) * (1 + (o.vibrato ? 0.01 * Math.sin(TAU * o.vibrato * s) : 0));
    ph = (ph + f / SR) % 1;
    const x = osc ? osc(f) : Math.sin(TAU * ph);
    const env = o.env === 'swell' ? swell(p, 1.2) : o.env === 'flat' ? Math.min(1, s / 0.005, (dur - s) / 0.01) : (s < 0.003 ? s / 0.003 : 1) * (1 - p);
    w(i0 + k, drive(lp(x, o.cut ?? 8000, 0.8).lp, o.drive ?? 1) * env * 0.5);
  }
}

export { crusher };
