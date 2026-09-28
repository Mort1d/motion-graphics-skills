// Pitched voices: basses, pads, stabs, plucks, keys, bells, leads, chip, brass, vocal pads. Notes are MIDI numbers or
// names ('C3', 'F#4'); chords are arrays of notes. Common opts: vel, pan, bus, verb, delay. Character options change
// the timbre — the same function should sound different in a lo-fi café reel and a drift-phonk car reel.
import { SR, TAU, ctx, writer, at, noise, rand, svf, saw, pulse, sine, supersawOsc, drive, clamp, lerp, hz, note as toMidi, gate, delayLine, panLR } from './core.mjs';

const beatSec = () => 60 / ctx.bpm;

// ================================================================== BASS
/**
 * 808 bass: a sine with a punch transient, optional glide from another note, tanh drive (the trap / phonk low end).
 * o: from (note to glide from), glide (s), drive (1 clean … 4 distorted), decay (1/s; 0 = no decay), punch (0..1),
 * cut (Hz, tames the distortion), vel, bus ('bass').
 */
export function bass808(t, dur, n, o = {}) {
  const f1 = hz(n);
  const f0 = o.from != null ? hz(o.from) : f1;
  const glide = o.glide ?? 0.075;
  const dr = o.drive ?? 2.2;
  const w = writer(o.bus || 'bass', { gain: o.vel ?? 1, verb: o.verb, delay: o.delay });
  const lp = svf();
  const i0 = at(t);
  const n1 = Math.floor((dur + 0.03) * SR);
  let ph = 0;
  for (let k = 0; k < n1; k++) {
    const s = k / SR;
    const g = f0 === f1 ? 1 : clamp(s / glide);
    let f = f0 * Math.pow(f1 / f0, g * g * (3 - 2 * g));
    if (f0 === f1) f *= 1 + (o.punch ?? 0.5) * Math.exp(-s * 70);
    ph += (TAU * f) / SR;
    const amp = (s < 0.003 ? s / 0.003 : 1) * Math.exp(-s * (o.decay ?? 0.9)) * (s > dur ? Math.max(0, 1 - (s - dur) / 0.03) : 1);
    const x = Math.sin(ph) * amp;
    const v = Math.tanh(x * dr) * 0.8 + Math.tanh(x * dr * 2.6) * 0.07 + x * 0.3;
    w(i0 + k, lp(v, o.cut ?? 2400, 0.7).lp);
  }
}

/**
 * A whole bass line as ONE voice, so slides glide from the pitch actually sounding (phase-continuous).
 * notes: [{ t, dur, note, slide?, vel?, decay? }]. o: drive, cut, bus.
 */
export function bassLine(notes, o = {}) {
  if (!notes.length) return;
  const list = [...notes].sort((a, z) => a.t - z.t);
  const w = writer(o.bus || 'bass', { gain: o.vel ?? 1 });
  const lp = svf();
  const dr = o.drive ?? 1.9;
  let ph = 0;
  let fPrev = hz(list[0].note);
  list.forEach((nt, i) => {
    const next = list[i + 1];
    const end = Math.min(nt.t + nt.dur, next ? next.t : Infinity);
    const n1 = Math.floor((end - nt.t + 0.03) * SR);
    const i0 = at(nt.t);
    const fT = hz(nt.note);
    const f0 = nt.slide ? fPrev : fT;
    for (let k = 0; k < n1; k++) {
      const s = k / SR;
      const g = nt.slide ? Math.min(1, s / (o.glide ?? 0.075)) : 1;
      let f = f0 * Math.pow(fT / f0, g * g * (3 - 2 * g));
      if (!nt.slide) f *= 1 + 0.5 * Math.exp(-s * 70);
      ph += (TAU * f) / SR;
      const left = end - nt.t - s;
      const amp = (s < 0.003 ? s / 0.003 : 1) * Math.exp(-s * (nt.decay ?? o.decay ?? 0.9)) * (left < 0.02 ? Math.max(0, left / 0.02) : 1);
      const x = Math.sin(ph) * amp;
      const v = Math.tanh(x * dr) * 0.8 + Math.tanh(x * 5) * 0.07 + x * 0.3;
      w(i0 + k, lp(v, o.cut ?? 2400, 0.7).lp * (nt.vel ?? 1));
    }
    fPrev = fT;
  });
}

/** Clean sub sine (under plucks, pads, deep house): o.attack, o.release, o.drive. */
export function sub(t, dur, n, o = {}) {
  const f = hz(n);
  const w = writer(o.bus || 'bass', { gain: o.vel ?? 1 });
  const i0 = at(t);
  const len = dur + (o.release ?? 0.06);
  let ph = 0;
  for (let k = 0; k < len * SR; k++) {
    const s = k / SR;
    ph += (TAU * f) / SR;
    w(i0 + k, drive(Math.sin(ph), o.drive ?? 1.3) * gate(s, dur, o.attack ?? 0.01, o.release ?? 0.06));
  }
}

/** Reese: two detuned saws + a sub through a moving low-pass (dnb, dark trap, techy menace). */
export function reese(t, dur, n, o = {}) {
  const f0 = hz(n);
  const det = o.detune ?? 0.007;
  const w = writer(o.bus || 'bass', { gain: o.vel ?? 1 });
  const o1 = saw(); const o2 = saw(); const o3 = saw();
  const fl = svf();
  const i0 = at(t);
  let ph = 0;
  const wob = o.wobble ?? 1.7;
  for (let k = 0; k < (dur + 0.06) * SR; k++) {
    const s = k / SR;
    ph += (TAU * f0) / SR;
    const x = o1(f0 * (1 + det)) * 0.4 + o2(f0 * (1 - det)) * 0.4 + o3(f0 * 2 * (1 + det * 0.5)) * 0.15;
    const c = (o.cut ?? 520) + (o.env ?? 900) * Math.exp(-s * 9) + (o.move ?? 140) * Math.sin(TAU * wob * s);
    const v = (fl(x, c, 1.2).lp * 0.8 + Math.sin(ph) * (o.subLevel ?? 0.55)) * gate(s, dur, 0.005, 0.06);
    w(i0 + k, drive(v, o.drive ?? 1.6) * 0.85);
  }
}

/**
 * Acid bass (303-style): saw or square into a resonant low-pass with an envelope, accents and slides.
 * o: from (slide from note), cut, env (Hz of sweep), reso (q 2..12), decay (1/s), accent (bool), wave, drive.
 */
export function acid(t, dur, n, o = {}) {
  const f1 = hz(n);
  const f0 = o.from != null ? hz(o.from) : f1;
  const osc = o.wave === 'square' ? pulse(0.5) : saw();
  const w = writer(o.bus || 'bass', { gain: (o.vel ?? 1) * (o.accent ? 1.25 : 1), delay: o.delay });
  const lp = svf();
  const env = (o.env ?? 2200) * (o.accent ? 1.7 : 1);
  const i0 = at(t);
  for (let k = 0; k < (dur + 0.025) * SR; k++) {
    const s = k / SR;
    const g = f0 === f1 ? 1 : clamp(s / 0.06);
    const f = f0 * Math.pow(f1 / f0, g);
    const fc = (o.cut ?? 380) + env * Math.exp(-s * (o.decay ?? (o.accent ? 6 : 10)));
    const v = lp(osc(f), fc, o.reso ?? 6).lp * gate(s, dur, 0.002, 0.02);
    w(i0 + k, drive(v * 1.1, o.drive ?? 2.2) * 0.8);
  }
}

/** House / disco bass: saw + pulse through a plucky low-pass, a clean sub under it. o.bright (0..2), o.decay. */
export function houseBass(t, dur, n, o = {}) {
  const f0 = hz(n);
  const w = writer(o.bus || 'bass', { gain: o.vel ?? 1 });
  const o1 = saw(); const o2 = pulse(0.35);
  const lp = svf();
  const i0 = at(t);
  let ph = 0;
  const bright = o.bright ?? 1;
  for (let k = 0; k < (dur + 0.05) * SR; k++) {
    const s = k / SR;
    ph += (TAU * f0) / SR;
    const amp = (s < 0.004 ? s / 0.004 : 1) * (s < dur ? Math.exp(-s * (o.decay ?? 3)) : Math.exp(-dur * (o.decay ?? 3)) * Math.max(0, 1 - (s - dur) / 0.05));
    const cut = 180 + 1500 * bright * Math.exp(-s * 18);
    const v = (lp(o1(f0) * 0.6 + o2(f0 * 1.002) * 0.4, cut, 1.3).lp * 0.8 + Math.sin(ph) * 0.65) * amp;
    w(i0 + k, Math.tanh(v * 1.5) * 0.8);
  }
}

/** FM bass: growl and bite (future bass, midtempo, dubstep-lite). o.ratio, o.index, o.wobble (Hz LFO on the index). */
export function fmBass(t, dur, n, o = {}) {
  const f = hz(n);
  const w = writer(o.bus || 'bass', { gain: o.vel ?? 1 });
  const lp = svf();
  const i0 = at(t);
  let pc = 0; let pm = 0;
  const ratio = o.ratio ?? 1;
  for (let k = 0; k < (dur + 0.04) * SR; k++) {
    const s = k / SR;
    pm += (TAU * f * ratio) / SR;
    pc += (TAU * f) / SR;
    const lfo = o.wobble ? 0.5 + 0.5 * Math.sin(TAU * o.wobble * s - Math.PI / 2) : 1;
    const idx = ((o.index ?? 3) * Math.exp(-s * 6) + (o.sustain ?? 1.2)) * lfo;
    const v = Math.sin(pc + idx * Math.sin(pm)) * gate(s, dur, 0.003, 0.04);
    w(i0 + k, lp(drive(v, o.drive ?? 2), o.cut ?? 3200, 0.8).lp);
  }
}

// ================================================================== PADS, STABS
/**
 * Detuned-saw chord (a supersaw): pads, EDM chords, stabs. o: voices (5..9), detune (semitones), width,
 * cut (static Hz) | cutFn(tAbsolute) → Hz | cutHi + cutLo + fdec (a decaying filter envelope, for stabs);
 * hp (keeps it out of the bass, default 180), attack, release, q, bus ('music').
 */
export function supersaw(t, dur, notes, o = {}) {
  const w = writer(o.bus || 'music', { pan: o.pan, verb: o.verb ?? 0.3, delay: o.delay, gain: o.vel ?? 1 });
  const oscs = notes.map((m, ni) => ({ osc: supersawOsc(o.voices ?? 6, o.detune ?? 0.16, (o.width ?? 0.9) * (ni % 2 ? -1 : 1)), f: hz(m) }));
  const fl = svf(); const fr = svf(); const hl = svf(); const hr = svf();
  const att = o.attack ?? 0.35;
  const rel = o.release ?? 0.7;
  const norm = 1 / Math.sqrt(notes.length);
  const i0 = at(t);
  for (let k = 0; k < (dur + rel) * SR; k++) {
    const s = k / SR;
    const env = (s < att ? Math.sin((s / att) * Math.PI / 2) : 1) * (s < dur ? 1 : Math.exp(-((s - dur) / rel) * 4));
    let l = 0; let r = 0;
    for (const v of oscs) { const [a, b] = v.osc(v.f); l += a; r += b; }
    const cut = o.cutFn ? o.cutFn(t + s) : o.cutHi != null ? (o.cutLo ?? 600) + (o.cutHi - (o.cutLo ?? 600)) * Math.exp(-s * (o.fdec ?? 8)) : (o.cut ?? 2600);
    const q = o.q ?? 0.8;
    w(i0 + k, hl(fl(l * norm, cut, q).lp, o.hp ?? 180, 0.7).hp * env * 0.4, hr(fr(r * norm, cut, q).lp, o.hp ?? 180, 0.7).hp * env * 0.4);
  }
}

/** Short chord hit (house stab, EDM stab, brass-ish hit): supersaw with a snappy filter. */
export const stab = (t, notes, o = {}) => supersaw(t, o.dur ?? 0.16, notes, { attack: 0.003, release: 0.14, cutHi: 5200, cutLo: 700, fdec: 9, voices: 5, verb: 0.3, ...o });

/**
 * Pad: sustained chord bed. type: 'warm' (analog), 'dark' (filtered), 'air' (breathy, bright, wide), 'strings'
 * (ensemble with vibrato), 'glass' (FM crystal, clean tech / luxury). o: attack, release, cut, move (filter LFO depth).
 */
export function pad(t, dur, notes, o = {}) {
  const type = o.type || 'warm';
  if (type === 'glass') return glassPad(t, dur, notes, o);
  const P = {
    warm: { voices: 5, detune: 0.14, cut: 1500, attack: 0.5, release: 0.9, hp: 160 },
    dark: { voices: 5, detune: 0.12, cut: 750, attack: 0.7, release: 1, hp: 120 },
    air: { voices: 7, detune: 0.22, cut: 6500, attack: 0.9, release: 1.4, hp: 450, width: 1.2 },
    strings: { voices: 4, detune: 0.09, cut: 2800, attack: 0.4, release: 0.8, hp: 200 },
  }[type] || {};
  const p = { ...P, ...o };
  const vib = type === 'strings' ? (tAbs) => 1 + 0.0035 * Math.sin(TAU * 5.3 * tAbs) : null;
  const move = p.move ?? 0.18;
  const cutFn = (tAbs) => p.cut * (1 + move * Math.sin(TAU * 0.23 * tAbs));
  if (!vib) {
    supersaw(t, dur, notes, { ...p, cutFn, verb: p.verb ?? 0.45, q: 0.7 });
  } else {
    // strings: per-voice vibrato needs its own oscillators
    const w = writer(p.bus || 'music', { pan: p.pan, verb: p.verb ?? 0.5, delay: p.delay, gain: p.vel ?? 1 });
    const oscs = notes.flatMap((m, ni) => [-0.09, 0, 0.1].map((d, j) => ({ o: saw(), f: hz(m) * Math.pow(2, d / 12), p: panLR(((j - 1) * 0.6 + (ni % 2 ? 0.2 : -0.2))) })));
    const fl = svf(); const fr = svf(); const hl = svf(); const hr = svf();
    const norm = 1 / Math.sqrt(oscs.length);
    const i0 = at(t);
    for (let k = 0; k < (dur + p.release) * SR; k++) {
      const s = k / SR;
      const env = (s < p.attack ? Math.sin((s / p.attack) * Math.PI / 2) : 1) * (s < dur ? 1 : Math.exp(-((s - dur) / p.release) * 4));
      const v = vib(t + s);
      let l = 0; let r = 0;
      for (const os of oscs) { const x = os.o(os.f * v); l += x * os.p[0]; r += x * os.p[1]; }
      const c = cutFn(t + s);
      w(i0 + k, hl(fl(l * norm, c, 0.7).lp, p.hp, 0.7).hp * env * 0.4, hr(fr(r * norm, c, 0.7).lp, p.hp, 0.7).hp * env * 0.4);
    }
  }
}

function glassPad(t, dur, notes, o) {
  const w = writer(o.bus || 'music', { pan: o.pan, verb: o.verb ?? 0.55, delay: o.delay ?? 0.1, gain: o.vel ?? 1 });
  const att = o.attack ?? 0.6;
  const rel = o.release ?? 1.2;
  const vs = notes.map((m, i) => ({ f: hz(m), pc: rand() * TAU, pm: 0, p: panLR((i / Math.max(1, notes.length - 1) - 0.5) * 1.2) }));
  const norm = 0.22 / Math.sqrt(notes.length);
  const i0 = at(t);
  for (let k = 0; k < (dur + rel) * SR; k++) {
    const s = k / SR;
    const env = (s < att ? Math.sin((s / att) * Math.PI / 2) : 1) * (s < dur ? 1 : Math.exp(-((s - dur) / rel) * 4));
    let l = 0; let r = 0;
    for (const v of vs) {
      v.pm += (TAU * v.f * 3.01) / SR;
      v.pc += (TAU * v.f) / SR;
      const x = Math.sin(v.pc + (0.6 + 0.25 * Math.sin(TAU * 0.3 * (t + s))) * Math.sin(v.pm)) + 0.3 * Math.sin(2 * v.pc);
      l += x * v.p[0]; r += x * v.p[1];
    }
    w(i0 + k, l * norm * env, r * norm * env);
  }
}

// ================================================================== PLUCKS, KEYS, BELLS
/**
 * Plucked voices. type: 'synth' (2-saw snappy filter — pop, house, future hooks), 'harp' (additive string — organic,
 * flowers, weddings, kids), 'ks' (Karplus-Strong string — guitar / koto colour), 'marimba', 'kalimba' (modal, playful),
 * 'fm' (glassy DX pluck — tech, corporate). o: dur (ring), bright (0..1), vel, pan, bus ('music').
 */
export function pluck(t, n, o = {}) {
  const type = o.type || 'synth';
  const f = hz(n);
  const dur = o.dur ?? (type === 'synth' ? 0.35 : 1.4);
  const w = writer(o.bus || 'music', { pan: o.pan, verb: o.verb ?? 0.3, delay: o.delay, gain: o.vel ?? 1 });
  const i0 = at(t);
  const bright = o.bright ?? 0.5;
  if (type === 'synth') {
    const o1 = saw(); const o2 = saw(); const fl = svf();
    for (let k = 0; k < (dur + 0.25) * SR; k++) {
      const s = k / SR;
      const amp = (s < 0.003 ? s / 0.003 : 1) * Math.exp(-s * 3.2) * (s < dur ? 1 : Math.exp(-(s - dur) * 18));
      const c = (o.cutLo ?? 500) + (o.cutHi ?? 2000 + 6400 * bright) * Math.exp(-s * (o.fdec ?? 11));
      w(i0 + k, fl(o1(f * 1.004) * 0.55 + o2(f * 0.996) * 0.55, c, 1.1).lp * amp);
    }
  } else if (type === 'harp') {
    const H = Math.max(1, Math.min(12, Math.floor(15000 / f)));
    const hs = [];
    for (let k = 1; k <= H; k++) {
      const wk = (TAU * f * k * (1 + 0.0004 * k * k)) / SR; // a touch of string stiffness
      const ph = rand() * TAU;
      hs.push({ c: Math.cos(wk), s: Math.sin(wk), x: Math.cos(ph), y: Math.sin(ph), a: Math.pow(k, -(1.7 - bright)) * (k === 2 ? 0.8 : 1),
        d: Math.exp(-(2.6 / dur + (0.9 + 5 * (1 - bright)) * (k - 1) * (k - 1) * 0.35) / SR) });
    }
    const norm = 1.2 / hs.reduce((q, h) => q + h.a, 0);
    const n1 = Math.floor(dur * SR);
    for (let k = 0; k < n1; k++) {
      let v = 0;
      for (const h of hs) { const x = h.x * h.c - h.y * h.s; h.y = h.x * h.s + h.y * h.c; h.x = x; h.a *= h.d; v += h.y * h.a; }
      w(i0 + k, v * norm * (k < 24 ? k / 24 : 1) * (k > n1 - 1200 ? (n1 - k) / 1200 : 1));
    }
  } else if (type === 'ks') {
    const period = SR / f;
    const dl = delayLine(1 / Math.max(20, f) + 0.01);
    const loss = Math.pow(0.001, 1 / (f * dur)); // reaches -60 dB after `dur` seconds
    const exc = svf();
    let prev = 0;
    const burst = Math.floor(period);
    const n1 = Math.floor((dur + 0.05) * SR);
    for (let k = 0; k < n1; k++) {
      const x = k < burst ? exc(noise(), 800 + 9000 * bright, 0.7).lp : 0;
      const y = dl.read(period - 1.5); // + the averaging filter's half sample = one period
      const avg = (y + prev) * 0.5;
      prev = y;
      dl.write(x + avg * loss);
      w(i0 + k, y * 0.9 * (k > n1 - 600 ? (n1 - k) / 600 : 1));
    }
  } else if (type === 'marimba' || type === 'kalimba') {
    const modes = type === 'marimba' ? [[1, 1, 1], [3.99, 0.22, 0.28], [10.1, 0.06, 0.1]] : [[1, 1, 1], [2.01, 0.12, 0.4], [5.27, 0.18, 0.14]];
    const ps = modes.map(() => rand() * TAU);
    const click = svf();
    for (let k = 0; k < (dur + 0.02) * SR; k++) {
      const s = k / SR;
      let v = 0;
      modes.forEach(([r, a, d], j) => { ps[j] += (TAU * f * r) / SR; v += Math.sin(ps[j]) * a * Math.exp(-s / (dur * d * (type === 'marimba' ? 0.5 : 0.8))); });
      v += click(noise(), f * 5, 2).bp * Math.exp(-s * 400) * 0.3;
      w(i0 + k, v * 0.6 * (s < 0.001 ? s / 0.001 : 1));
    }
  } else { // 'fm'
    let pc = 0; let pm = 0;
    for (let k = 0; k < (dur + 0.02) * SR; k++) {
      const s = k / SR;
      pm += (TAU * f * (o.ratio ?? 1)) / SR;
      pc += (TAU * f) / SR;
      const idx = (1 + 3 * bright) * Math.exp(-s * 14);
      w(i0 + k, Math.sin(pc + idx * Math.sin(pm)) * Math.exp(-s * (3 / dur)) * (s < 0.002 ? s / 0.002 : 1) * 0.7);
    }
  }
}

/**
 * Keys. type: 'ep' (FM electric piano: lo-fi, soul, luxury), 'organ' (drawbars: house, gospel, garage),
 * 'piano' (additive, soft attack — cinematic, emotional), 'clav' (funky, nu-disco). notes: a chord.
 */
export function keys(t, dur, notes, o = {}) {
  const type = o.type || 'ep';
  const w = writer(o.bus || 'music', { pan: o.pan, verb: o.verb ?? 0.35, delay: o.delay, gain: o.vel ?? 1 });
  const i0 = at(t);
  const rel = o.release ?? (type === 'organ' ? 0.08 : 0.5);
  const vs = notes.map((m, ni) => ({ f: hz(m), vel: 0.8 + 0.2 * rand(), p: panLR((ni / Math.max(1, notes.length - 1) - 0.5) * 0.5), ph: Array.from({ length: 12 }, () => rand() * TAU) }));
  const norm = 0.6 / Math.sqrt(notes.length);
  const lp = svf(); const lp2 = svf();
  for (let k = 0; k < (dur + rel) * SR; k++) {
    const s = k / SR;
    let l = 0; let r = 0;
    for (const v of vs) {
      let x = 0;
      if (type === 'ep') {
        v.ph[1] += (TAU * v.f) / SR; v.ph[2] += (TAU * v.f * 14) / SR; v.ph[0] += (TAU * v.f) / SR;
        const idx = (1.6 * Math.exp(-s * 2.5) + 0.25) * (o.bright ?? 1);
        x = Math.sin(v.ph[0] + idx * Math.sin(v.ph[1]) + Math.sin(v.ph[2]) * 0.9 * Math.exp(-s * 30)) * Math.exp(-s * 1.1) * (1 + 0.12 * Math.sin(TAU * 4.5 * s));
      } else if (type === 'organ') {
        const bars = [[0.5, 0.45], [1, 1], [1.5, 0.55], [2, 0.5], [3, 0.3], [4, 0.28]];
        const vib = 1 + 0.002 * Math.sin(TAU * 6.4 * s);
        bars.forEach(([r, a], j) => { v.ph[j] += (TAU * v.f * r * vib) / SR; x += Math.sin(v.ph[j]) * a; });
        x = x * 0.35 + (s < 0.004 ? noise() * 0.3 * (1 - s / 0.004) : 0);
      } else if (type === 'piano') {
        for (let h = 1; h <= 8; h++) {
          v.ph[h] += (TAU * v.f * h * (1 + 0.00035 * h * h)) / SR;
          x += (Math.sin(v.ph[h]) / Math.pow(h, 1.25)) * Math.exp(-s * (0.9 + h * 0.55));
        }
        x = x * 0.55 + (s < 0.006 ? noise() * 0.15 * (1 - s / 0.006) : 0);
      } else { // clav
        v.ph[0] = (v.ph[0] + v.f / SR) % 1;
        x = (v.ph[0] < 0.22 ? 1 : -1) * Math.exp(-s * 7);
      }
      x *= v.vel;
      l += x * v.p[0]; r += x * v.p[1];
    }
    const env = (s < 0.003 ? s / 0.003 : 1) * (s < dur ? 1 : Math.exp(-((s - dur) / rel) * 5));
    if (type === 'clav') { l = lp(l, 2600, 2.5).bp; r = lp2(r, 2600, 2.5).bp; }
    w(i0 + k, l * norm * env, r * norm * env);
  }
}

/**
 * FM bell family (2 operators). ratio 3.5 bell, 3.01 glass, 2 chime, 4 marimba-ish, 1.41 metallic coin. index = brightness,
 * idec = how fast the brightness fades (1/s). dur = ring length.
 */
export function bell(t, n, o = {}) {
  const f = hz(n);
  const dur = o.dur ?? 1.2;
  const w = writer(o.bus || 'music', { pan: o.pan, verb: o.verb ?? 0.5, delay: o.delay, gain: o.vel ?? 1 });
  const i0 = at(t);
  let pc = 0; let pm = 0;
  const ratio = o.ratio ?? 3.5;
  for (let k = 0; k < dur * SR; k++) {
    const s = k / SR;
    pm += (TAU * f * ratio) / SR;
    pc += (TAU * f) / SR;
    const idx = (o.index ?? 2.4) * Math.exp(-s * (o.idec ?? 6));
    const env = (s < 0.002 ? s / 0.002 : 1) * Math.exp(-s * (5.9 / dur)) * (s > dur - 0.01 ? (dur - s) / 0.01 : 1);
    w(i0 + k, Math.sin(pc + idx * Math.sin(pm)) * env * 0.8);
  }
}

// ================================================================== LEADS
/**
 * Mono lead. wave: 'saw' | 'square' | 'pulse' (width o.pw) | 'sine' | 'tri'; unison (1..3) with detune (semitones);
 * cut / env / reso (filter), vib (semitones) after vibDelay (s), from + glide (portamento), drive, bus ('lead').
 */
export function lead(t, dur, n, o = {}) {
  const f1 = hz(n);
  const f0 = o.from != null ? hz(o.from) : f1;
  const uni = Math.max(1, Math.min(3, o.unison ?? 1));
  const det = o.detune ?? 0.08;
  const mk = () => (o.wave === 'square' ? pulse(0.5) : o.wave === 'pulse' ? pulse(o.pw ?? 0.25) : o.wave === 'sine' ? sine() : o.wave === 'tri' ? triOsc() : saw());
  const oscs = Array.from({ length: uni }, (_, j) => ({ o: mk(), r: Math.pow(2, ((uni === 1 ? 0 : (j / (uni - 1)) * 2 - 1) * det) / 12), p: panLR(uni === 1 ? 0 : ((j / (uni - 1)) * 2 - 1) * 0.6) }));
  const w = writer(o.bus || 'lead', { pan: o.pan, verb: o.verb ?? 0.2, delay: o.delay ?? 0.15, gain: o.vel ?? 1 });
  const fl = svf(); const fr = svf();
  const i0 = at(t);
  const rel = o.release ?? 0.08;
  for (let k = 0; k < (dur + rel) * SR; k++) {
    const s = k / SR;
    const g = f0 === f1 ? 1 : clamp(s / (o.glide ?? 0.08));
    const vd = o.vibDelay ?? 0.25;
    const vib = o.vib ? Math.pow(2, (o.vib * Math.sin(TAU * (o.vibRate ?? 5.5) * s) * clamp((s - vd) / 0.3)) / 12) : 1;
    const f = f0 * Math.pow(f1 / f0, g * g * (3 - 2 * g)) * vib;
    let l = 0; let r = 0;
    for (const v of oscs) { const x = v.o(f * v.r); l += x * v.p[0]; r += x * v.p[1]; }
    const c = (o.cut ?? 3200) + (o.env ?? 1800) * Math.exp(-s * (o.fdec ?? 8));
    const env = gate(s, dur, o.attack ?? 0.004, rel);
    const q = o.reso ?? 0.9;
    w(i0 + k, drive(fl(l / Math.sqrt(uni), c, q).lp, o.drive ?? 1.2) * env * 0.5, drive(fr(r / Math.sqrt(uni), c, q).lp, o.drive ?? 1.2) * env * 0.5);
  }
}
function triOsc() {
  let ph = rand();
  return (f) => { ph = (ph + f / SR) % 1; return ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4; };
}

/**
 * Chip voice (NES-like): thin pulse (duty 0.125 / 0.25 / 0.5), pitch slide in, vibrato, fast arpeggio `arp`
 * (semitone offsets cycled every `rate` beats — the chip chord), `echo` (dotted-8th repeats). bus ('lead').
 */
export function chip(t, dur, n, o = {}) {
  const f0 = hz(n);
  const w = writer(o.bus || 'lead', { pan: o.pan, verb: o.verb ?? 0.15, delay: o.delay, gain: o.vel ?? 1 });
  const osc = pulse(o.duty ?? 0.25);
  const lp = svf();
  const i0 = at(t);
  const rel = o.release ?? 0.04;
  const step = (o.rate ?? 1 / 8) * beatSec();
  for (let k = 0; k < (dur + rel) * SR; k++) {
    const s = k / SR;
    const semi = (o.arp ? o.arp[Math.floor(s / step) % o.arp.length] : 0) + (o.slide ?? 0) * Math.exp(-s * 45);
    const f = f0 * Math.pow(2, semi / 12) * (1 + (o.vib ?? 0) * Math.sin(TAU * 6 * s) * Math.min(1, s * 3));
    const env = (s < 0.003 ? s / 0.003 : 1) * Math.exp(-s * (o.decay ?? 1.2)) * (s < dur ? 1 : Math.max(0, 1 - (s - dur) / rel));
    w(i0 + k, lp(osc(f), o.cut ?? 7000, 0.7).lp * env * 0.45);
  }
  if (o.echo) {
    const e = beatSec() * 0.75;
    chip(t + e, dur, n, { ...o, echo: false, vel: (o.vel ?? 1) * 0.35, pan: -(o.pan ?? 0.3) || -0.3 });
    chip(t + 2 * e, dur, n, { ...o, echo: false, vel: (o.vel ?? 1) * 0.14, pan: o.pan ?? 0.3 });
  }
}

/** NES-style triangle bass (4-bit steps) with a sine under it — chiptune low end. */
export function chipBass(t, dur, n, o = {}) {
  const f = hz(n);
  const w = writer(o.bus || 'bass', { gain: o.vel ?? 1 });
  const i0 = at(t);
  let ph = 0;
  for (let k = 0; k < (dur + 0.03) * SR; k++) {
    const s = k / SR;
    ph = (ph + f / SR) % 1;
    const tr = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
    w(i0 + k, (Math.round(tr * 7.5) / 7.5 * 0.55 + Math.sin(TAU * ph) * 0.45) * gate(s, dur, 0.003, 0.03) * 1.2);
  }
}

/** Brass section: detuned saws per note with a filter swell (hype stabs, sports, trailers, latin). o.swell (s). */
export function brass(t, dur, notes, o = {}) {
  const w = writer(o.bus || 'music', { pan: o.pan, verb: o.verb ?? 0.3, delay: o.delay, gain: o.vel ?? 1 });
  const vs = notes.flatMap((m) => [-0.07, 0, 0.08].map((d) => ({ o: saw(), f: hz(m) * Math.pow(2, d / 12) })));
  const fl = svf(); const fr = svf();
  const i0 = at(t);
  const swl = o.swell ?? 0.07;
  const norm = 1 / Math.sqrt(vs.length);
  for (let k = 0; k < (dur + 0.12) * SR; k++) {
    const s = k / SR;
    const vib = 1 + 0.004 * Math.sin(TAU * 5.5 * s) * clamp((s - 0.2) / 0.3);
    let x = 0;
    for (const v of vs) x += v.o(v.f * vib);
    const c = 350 + (o.cut ?? 3200) * (1 - Math.exp(-s / swl)) * (0.75 + 0.25 * Math.exp(-s * 3));
    const env = gate(s, dur, 0.012, 0.1);
    w(i0 + k, drive(fl(x * norm, c, 0.9).lp, 1.6) * env * 0.5, drive(fr(x * norm, c * 0.97, 0.9).lp, 1.6) * env * 0.5);
  }
}

// Formants (Hz, gain): the vowel of a synthetic voice.
const VOWEL = {
  a: [[730, 1], [1090, 0.5], [2440, 0.25]], e: [[530, 1], [1840, 0.4], [2480, 0.2]], i: [[270, 1], [2290, 0.35], [3010, 0.2]],
  o: [[570, 1], [840, 0.45], [2410, 0.12]], u: [[300, 1], [870, 0.3], [2240, 0.08]],
};
/**
 * Vocal-ish voice: detuned saws through three formant band-passes. Long notes = choir / "ooh" pad; short = vocal chop
 * (future bass, house). o: vowel ('a','e','i','o','u'), toVowel (morph over the note), attack, release, vib.
 */
export function vox(t, dur, n, o = {}) {
  const A = VOWEL[o.vowel || 'o'];
  const Z = VOWEL[o.toVowel || o.vowel || 'o'];
  const w = writer(o.bus || 'music', { pan: o.pan, verb: o.verb ?? 0.55, delay: o.delay, gain: o.vel ?? 1 });
  const oscs = [saw(), saw(), saw()];
  const dets = [-0.08, 0, 0.09];
  const fl = A.map(() => svf());
  const att = o.attack ?? 0.4;
  const rel = o.release ?? 0.6;
  const i0 = at(t);
  const f = hz(n);
  for (let k = 0; k < (dur + rel) * SR; k++) {
    const s = k / SR;
    const vib = 1 + (o.vib ?? 0.006) * Math.sin(TAU * 5.2 * s) * Math.min(1, s * 1.5);
    let x = 0;
    oscs.forEach((osc, j) => { x += osc(f * Math.pow(2, dets[j] / 12) * vib); });
    x /= 3;
    const m = clamp(s / Math.max(0.01, dur));
    let y = 0;
    fl.forEach((flt, j) => { y += flt(x + noise() * 0.02, lerp(A[j][0], Z[j][0], m), 6).bp * lerp(A[j][1], Z[j][1], m); });
    const env = Math.min(1, s / att) * (s < dur ? 1 : Math.exp(-((s - dur) / rel) * 3));
    w(i0 + k, y * env * 0.55);
  }
}
/** Vocal chop: a short, snappy vox (use on off-beats / as a hook). */
export const chop = (t, n, o = {}) => vox(t, o.dur ?? 0.14, n, { attack: 0.006, release: 0.06, vib: 0, verb: 0.3, delay: 0.2, ...o });

/**
 * Arpeggio helper: plays `notes` from t0 to t1 every `rate` beats. pattern 'up' | 'down' | 'updown' | 'random';
 * octaves: span; gate: fraction of the step each note sounds; voice(t, note, dur, vel, i) defaults to a synth pluck.
 */
export function arp(t0, t1, notes, o = {}) {
  const seq = [];
  const oct = o.octaves ?? 1;
  const base = notes.map(toMidi);
  for (let k = 0; k < oct; k++) for (const m of base) seq.push(m + 12 * k);
  const order = o.pattern === 'down' ? [...seq].reverse() : o.pattern === 'updown' ? [...seq, ...[...seq].reverse().slice(1, -1)] : seq;
  const step = (o.rate ?? 1 / 4) * beatSec();
  const voice = o.voice || ((tt, m, d, v) => pluck(tt, m, { type: 'synth', dur: d, vel: v * (o.vel ?? 1), pan: o.pan, bus: o.bus }));
  let i = 0;
  for (let tt = t0; tt < t1 - 1e-6; tt += step, i++) {
    const m = o.pattern === 'random' ? order[Math.floor(rand() * order.length)] : order[i % order.length];
    voice(tt, m, step * (o.gate ?? 0.8), i % 4 === 0 ? 1 : 0.8, i);
  }
  return i;
}
