// Mixer and master: bus inserts (filters, EQ, drive, crush, chorus, compressor, gain, sidechain, width), sends to a
// reverb and a tempo-synced ping-pong delay, arrangement moves on whole buses (gap, tape stop, stutter, filter
// automation), then the master: sub-mono, EQ, glue, loudness normalisation (ITU BS.1770 integrated LUFS) and a
// true-peak-aware look-ahead limiter. Writes a 24-bit WAV and reports what it did.
import fs from 'node:fs';
import path from 'node:path';
import { SR, TAU, ctx, bus, clamp, dbToGain, gainToDb, svf, biquad, drive, crusher, delayLine } from './core.mjs';

// ---- arrangement moves on whole buses (applied after every note is written) ---------------------------------------------
const MUSIC = ['drums', 'bass', 'music', 'lead'];
/** Silence buses between t0 and t1 (the hole right before a drop or a slam). */
export const gap = (t0, t1, { buses = MUSIC, fade = 0.004 } = {}) => ctx.events.push({ type: 'gap', t0, t1, buses, fade });
/** Tape stop: the buses slow down to nothing over dur (real resampling of what was written), silent until `until`. */
export const tapeStop = (t, dur, { buses = MUSIC, until = null } = {}) => ctx.events.push({ type: 'tapeStop', t, dur, buses, until });
/** Stutter: repeat the first `slice` beats after t, `reps` times (glitch cut, build-up). */
export const stutter = (t, { reps = 4, slice = 1 / 8, buses = MUSIC } = {}) => ctx.events.push({ type: 'stutter', t, reps, slice, buses });
/**
 * Automate a bus parameter over time: 'lp' / 'hp' (Hz, exponential between points) or 'gain' (dB, linear).
 * points: [[t, value], ...]. A filtered intro that opens into the drop = automate('music', 'lp', [[0, 400], [8, 12000]]).
 */
export function automate(name, param, points) {
  bus(name).auto[param] = [...points].sort((a, z) => a[0] - z[0]);
}

function valueAt(points, t, log) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      const p = (t - t0) / Math.max(1e-9, t1 - t0);
      return log ? v0 * Math.pow(v1 / v0, p) : v0 + (v1 - v0) * p;
    }
  }
  return points[points.length - 1][1];
}

function applyEvents(b) {
  const chans = [b.L, b.R, b.VL, b.VR, b.DL, b.DR].filter(Boolean);
  for (const e of ctx.events) {
    if (!e.buses.includes(b.name)) continue;
    if (e.type === 'gap') {
      const i0 = Math.floor(e.t0 * SR); const i1 = Math.floor(e.t1 * SR); const f = Math.max(1, Math.floor(e.fade * SR));
      for (const ch of chans) for (let i = Math.max(0, i0 - f); i < Math.min(ch.length, i1 + f); i++) {
        const g = i < i0 ? 1 - (i - (i0 - f)) / f : i >= i1 ? (i - i1) / f : 0;
        ch[i] *= clamp(g);
      }
    } else if (e.type === 'tapeStop') {
      const i0 = Math.floor(e.t * SR); const n = Math.floor(e.dur * SR);
      for (const ch of chans) {
        const src = ch.slice(i0, i0 + n + 2);
        for (let k = 0; k < n && i0 + k < ch.length; k++) {
          const tau = k / SR;
          const pos = (tau - (tau * tau) / (2 * e.dur)) * SR;
          const j = Math.floor(pos); const fr = pos - j;
          ch[i0 + k] = ((src[j] ?? 0) * (1 - fr) + (src[j + 1] ?? 0) * fr) * (1 - Math.pow(k / n, 3));
        }
        if (e.until != null) for (let i = i0 + n; i < Math.min(ch.length, Math.floor(e.until * SR)); i++) ch[i] = 0;
      }
    } else if (e.type === 'stutter') {
      const len = Math.floor(e.slice * (60 / ctx.bpm) * SR); const i0 = Math.floor(e.t * SR);
      for (const ch of chans) {
        const src = ch.slice(i0, i0 + len);
        for (let r = 1; r < e.reps; r++) for (let k = 0; k < len && i0 + r * len + k < ch.length; k++) {
          ch[i0 + r * len + k] = src[k] * Math.min(1, k / 96, (len - k) / 96);
        }
      }
    }
  }
}

// ---- inserts -----------------------------------------------------------------------------------------------------------------
function duckEnvelope(spec) {
  const specs = typeof spec === 'number' ? [{ from: 'kick', depth: spec }] : Array.isArray(spec) ? spec : [spec];
  const env = new Float32Array(ctx.len).fill(1);
  for (const s of specs) {
    const list = ctx.triggers.get(s.from || 'kick') || [];
    const att = s.attack ?? 0.003; const rel = s.release ?? 0.09; const depth = clamp(s.depth ?? 0.5);
    for (const [t, amount] of list) {
      const i0 = Math.floor(t * SR);
      const n = Math.floor((att + rel * 5) * SR);
      const d = depth * Math.min(1, amount);
      for (let k = 0; k < n && i0 + k < ctx.len; k++) {
        if (i0 + k < 0) continue;
        const sec = k / SR;
        const g = 1 - d * (sec < att ? sec / att : Math.exp(-(sec - att) / rel));
        if (g < env[i0 + k]) env[i0 + k] = g;
      }
    }
  }
  return env;
}

function compressor({ threshold = -18, ratio = 3, attack = 0.005, release = 0.12, makeup = 0 } = {}) {
  const ga = Math.exp(-1 / (attack * SR)); const gr = Math.exp(-1 / (release * SR));
  let lvl = 0;
  const mk = dbToGain(makeup);
  return (l, r) => {
    const x = Math.max(Math.abs(l), Math.abs(r));
    lvl = x > lvl ? ga * lvl + (1 - ga) * x : gr * lvl + (1 - gr) * x;
    const over = gainToDb(lvl + 1e-12) - threshold;
    return (over > 0 ? dbToGain(-over * (1 - 1 / ratio)) : 1) * mk;
  };
}

function processBus(b) {
  const o = b.opts;
  const L = b.L; const R = b.R;
  const n = ctx.len;
  const flt = [svf(), svf(), svf(), svf()];
  const eqs = (o.eq || []).map((e) => [biquad(e.type || 'peak', e.f, e.g ?? 0, e.q ?? 0.8), biquad(e.type || 'peak', e.f, e.g ?? 0, e.q ?? 0.8)]);
  const crL = o.crush ? crusher(o.crush.bits ?? 8, o.crush.rate ?? 4) : null;
  const crR = o.crush ? crusher(o.crush.bits ?? 8, o.crush.rate ?? 4) : null;
  const comp = o.comp ? compressor(o.comp) : null;
  const ch = o.chorus ? { d: delayLine(0.05), d2: delayLine(0.05), rate: o.chorus.rate ?? 0.8, depth: o.chorus.depth ?? 0.004, mix: o.chorus.mix ?? 0.35 } : null;
  const auto = b.auto;
  const gainLin = dbToGain(o.gain ?? 0);
  for (let i = 0; i < n; i++) {
    let l = L[i]; let r = R[i];
    const t = i / SR;
    const hp = auto.hp ? valueAt(auto.hp, t, true) : o.hp;
    const lp = auto.lp ? valueAt(auto.lp, t, true) : o.lp;
    if (hp) { l = flt[0](l, hp, 0.707).hp; r = flt[1](r, hp, 0.707).hp; }
    if (lp && lp < 20000) { l = flt[2](l, lp, o.lpq ?? 0.707).lp; r = flt[3](r, lp, o.lpq ?? 0.707).lp; }
    for (const [el, er] of eqs) { l = el(l); r = er(r); }
    if (o.drive && o.drive > 1) { l = drive(l, o.drive); r = drive(r, o.drive); }
    if (crL) { l = crL(l); r = crR(r); }
    if (ch) {
      ch.d.write(l); ch.d2.write(r);
      const m = ch.depth * SR * (1 + Math.sin(TAU * ch.rate * t)) * 0.5 + 0.012 * SR;
      const m2 = ch.depth * SR * (1 + Math.sin(TAU * ch.rate * t + Math.PI / 2)) * 0.5 + 0.014 * SR;
      l = l * (1 - ch.mix * 0.5) + ch.d.read(m) * ch.mix;
      r = r * (1 - ch.mix * 0.5) + ch.d2.read(m2) * ch.mix;
    }
    if (comp) { const g = comp(l, r); l *= g; r *= g; }
    const g = (auto.gain ? dbToGain(valueAt(auto.gain, t, false)) : gainLin);
    L[i] = l * g; R[i] = r * g;
  }
  if (o.duck) {
    const env = duckEnvelope(o.duck);
    for (let i = 0; i < n; i++) { L[i] *= env[i]; R[i] *= env[i]; }
    b.duckEnv = env;
  }
  const width = o.width ?? 1;
  const pan = o.pan ?? 0;
  if (width !== 1 || pan) {
    const pl = Math.min(1, 1 - pan); const pr = Math.min(1, 1 + pan);
    for (let i = 0; i < n; i++) {
      const m = (L[i] + R[i]) / 2; const s = ((L[i] - R[i]) / 2) * width;
      L[i] = (m + s) * pl; R[i] = (m - s) * pr;
    }
  }
}

// ---- reverb and delay returns ----------------------------------------------------------------------------------------------
/** Freeverb (Jezar): 8 combs + 4 all-passes per channel. room 0.7 room … 0.84 hall … 0.92 huge; damp 0.2 bright … 0.5 dark. */
function freeverb(inL, inR, { room = 0.84, damp = 0.3, width = 1, predelay = 0.012 } = {}) {
  const scale = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round(x * scale));
  const apT = [556, 441, 341, 225].map((x) => Math.round(x * scale));
  const mk = (spread) => ({ combs: combT.map((d) => ({ buf: new Float32Array(d + spread), i: 0, st: 0 })), aps: apT.map((d) => ({ buf: new Float32Array(d + spread), i: 0 })) });
  const chL = mk(0); const chR = mk(Math.round(23 * scale));
  const outL = new Float32Array(ctx.len); const outR = new Float32Array(ctx.len);
  const run = (c, x) => {
    let o = 0;
    for (const cb of c.combs) { const y = cb.buf[cb.i]; cb.st = y * (1 - damp) + cb.st * damp; cb.buf[cb.i] = x + cb.st * room; cb.i = (cb.i + 1) % cb.buf.length; o += y; }
    for (const a of c.aps) { const y = a.buf[a.i]; a.buf[a.i] = o + y * 0.5; a.i = (a.i + 1) % a.buf.length; o = y - o; }
    return o;
  };
  const pd = Math.floor(predelay * SR);
  const hl = svf(); const hr = svf();
  for (let i = 0; i < ctx.len; i++) {
    const j = i - pd;
    const xl = j >= 0 ? hl(inL[j], 250, 0.7).hp : 0;
    const xr = j >= 0 ? hr(inR[j], 250, 0.7).hp : 0;
    const x = (xl + xr) * 0.015;
    const l = run(chL, x); const r = run(chR, x);
    outL[i] = l * (0.5 + width / 2) + r * (0.5 - width / 2);
    outR[i] = r * (0.5 + width / 2) + l * (0.5 - width / 2);
  }
  return [outL, outR];
}
const REVERB = { room: { room: 0.72, damp: 0.35 }, hall: { room: 0.84, damp: 0.3 }, plate: { room: 0.8, damp: 0.15 }, huge: { room: 0.92, damp: 0.25 }, dark: { room: 0.86, damp: 0.55 } };

/** Ping-pong delay with a low-pass in the feedback: time in beats (0.75 = dotted eighth). */
function pingpong(inL, inR, { beats: bt = 0.75, feedback = 0.38, lp = 3800 } = {}) {
  const d = Math.max(1, Math.floor(bt * (60 / ctx.bpm) * SR));
  const bl = new Float32Array(d); const br = new Float32Array(d);
  const outL = new Float32Array(ctx.len); const outR = new Float32Array(ctx.len);
  const fl = svf(); const fr = svf();
  let p = 0;
  for (let i = 0; i < ctx.len; i++) {
    const yl = bl[p]; const yr = br[p];
    bl[p] = fl((inL[i] + inR[i]) * 0.5 + yr * feedback, lp, 0.7).lp;
    br[p] = fr(yl * feedback, lp, 0.7).lp;
    outL[i] = yl; outR[i] = yr;
    p = (p + 1) % d;
  }
  return [outL, outR];
}

// ---- loudness (ITU-R BS.1770-4 / EBU R128) ------------------------------------------------------------------------------------
function kWeighted(x) {
  // 48 kHz coefficients from the standard: a high shelf (+4 dB above ~1.7 kHz) then the RLB high-pass (~38 Hz)
  const y = new Float64Array(x.length);
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0; let z1 = 0; let z2 = 0; let w1 = 0; let w2 = 0;
  for (let i = 0; i < x.length; i++) {
    const a = 1.53512485958697 * x[i] - 2.69169618940638 * x1 + 1.19839281085285 * x2 + 1.69065929318241 * y1 - 0.73248077421585 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = a;
    const b = a - 2 * z1 + z2 + 1.99004745483398 * w1 - 0.99007225036621 * w2;
    z2 = z1; z1 = a; w2 = w1; w1 = b;
    y[i] = b;
  }
  return y;
}
/** Integrated loudness in LUFS (gated), plus short-term (3 s) loudness at any window via the returned helper. */
export function loudness(L, R) {
  const kl = kWeighted(L); const kr = kWeighted(R);
  const cum = new Float64Array(L.length + 1);
  for (let i = 0; i < L.length; i++) cum[i + 1] = cum[i] + kl[i] * kl[i] + kr[i] * kr[i];
  const ms = (a, z) => (cum[z] - cum[a]) / Math.max(1, z - a);
  const blk = Math.floor(0.4 * SR); const hop = Math.floor(0.1 * SR);
  const zs = [];
  for (let a = 0; a + blk <= L.length; a += hop) zs.push(ms(a, a + blk));
  const lk = (z) => -0.691 + 10 * Math.log10(z + 1e-20);
  const abs = zs.filter((z) => lk(z) > -70);
  if (!abs.length) return { I: -Infinity, window: () => -Infinity };
  const rel = lk(abs.reduce((s, z) => s + z, 0) / abs.length) - 10;
  const gated = abs.filter((z) => lk(z) > rel);
  const I = lk(gated.reduce((s, z) => s + z, 0) / gated.length);
  const window = (t0, t1) => lk(ms(Math.max(0, Math.floor(t0 * SR)), Math.min(L.length, Math.floor(t1 * SR))));
  return { I, window };
}

// 4× oversampling interpolator (windowed sinc, 12 taps per phase) for true-peak estimation.
const TP_TAPS = (() => {
  const N = 48; const h = [];
  for (let i = 0; i < N; i++) {
    const x = (i - N / 2 + 0.5) / 4;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const win = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (N - 1));
    h.push(sinc * win);
  }
  return [0, 1, 2, 3].map((p) => h.filter((_, i) => i % 4 === p));
})();
export function truePeak(L, R) {
  let peak = 0;
  for (const x of [L, R]) {
    for (let i = 6; i < x.length - 6; i++) {
      const a = Math.abs(x[i]);
      if (a > peak) peak = a;
      if (a < peak * 0.7 && Math.abs(x[i + 1]) < peak * 0.7) continue; // an inter-sample peak needs a loud neighbour
      for (let p = 0; p < 4; p++) {
        const h = TP_TAPS[p];
        let y = 0;
        for (let k = 0; k < h.length; k++) y += h[k] * x[i - 5 + k];
        if (Math.abs(y) > peak) peak = Math.abs(y);
      }
    }
  }
  return gainToDb(peak);
}

/** Look-ahead peak limiter: gain = box-smoothed moving minimum (no clicks), then release. Returns the gain curve. */
function limit(L, R, ceilingDb, { look = 0.005, release = 0.12 } = {}) {
  const n = L.length;
  const c = dbToGain(ceilingDb);
  const la = Math.max(1, Math.floor(look * SR));
  const want = new Float32Array(n);
  for (let i = 0; i < n; i++) want[i] = Math.min(1, c / Math.max(1e-9, Math.abs(L[i]), Math.abs(R[i])));
  // moving minimum over the next `la` samples (monotonic deque)
  const mn = new Float32Array(n);
  const dq = new Int32Array(n); let h = 0; let t = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && want[dq[t - 1]] >= want[i]) t--;
    dq[t++] = i;
    while (dq[h] > i + la) h++;
    mn[i] = want[dq[h]];
  }
  // box average of the minimum over the look-ahead: a ramp that reaches the needed gain exactly at the peak
  const g = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) { acc += mn[i]; if (i >= la) acc -= mn[i - la]; g[i] = Math.min(mn[i], acc / Math.min(i + 1, la)); }
  const rel = Math.exp(-1 / (release * SR));
  let cur = 1;
  let maxGr = 0;
  for (let i = 0; i < n; i++) {
    cur = g[i] < cur ? g[i] : cur * rel + g[i] * (1 - rel);
    L[i] = clamp(L[i] * cur, -c, c); R[i] = clamp(R[i] * cur, -c, c);
    if (cur < 1) maxGr = Math.max(maxGr, -gainToDb(cur));
  }
  return maxGr;
}

// ---- render ------------------------------------------------------------------------------------------------------------------
// one NaN in a bus (a note name or undefined where a number is expected) would silence the whole mix at the limiter
// without a word: find it and say where
function finite(b, where) {
  for (const [name, buf] of [['L', b.L], ['R', b.R], ['reverb send', b.VL], ['delay send', b.DL]]) {
    if (!buf) continue;
    for (let i = 0; i < buf.length; i++) {
      if (!Number.isFinite(buf[i])) {
        throw new Error(`bus '${b.name}' (${name}) has a non-finite sample at ${(i / SR).toFixed(3)} s ${where}: `
          + 'a voice got NaN — usually a note name or undefined where a number (Hz, dB, seconds) is expected');
      }
    }
  }
}

/**
 * Mixes every bus, masters and writes the WAV. o: lufs (target, default -14), truePeak (ceiling dBTP, default -1),
 * reverb ('room'|'hall'|'plate'|'huge'|'dark' or { room, damp, width, predelay }), delay ({ beats, feedback, lp }),
 * eq (master bands [{ f, g, q, type }]), glue (0 = off … 1 = gentle tape-like saturation), monoBass (Hz, default 120),
 * fadeOut (s at the very end, default 0.25), sections ({ name: [t0, t1] } → a per-bus balance table), report (bool).
 */
export function render(file, o = {}) {
  const t0 = Date.now();
  const n = ctx.len;
  const verbIn = [new Float32Array(n), new Float32Array(n)];
  const delayIn = [new Float32Array(n), new Float32Array(n)];
  const mixL = new Float64Array(n); const mixR = new Float64Array(n);
  const stats = [];
  for (const b of ctx.buses.values()) {
    if (b.name === 'verb' || b.name === 'delay') continue;
    finite(b, 'as written by the voices');
    applyEvents(b);
    // per-voice sends ride the bus's own gain and ducking
    processBus(b);
    finite(b, 'after its bus effects (check the options of this bus: eq, lp / hp, automation)');
    const g = dbToGain(b.opts.gain ?? 0);
    const env = b.duckEnv;
    const vs = b.opts.verb ?? 0; const ds = b.opts.delay ?? 0;
    const mute = b.opts.mute ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const e = env ? env[i] : 1;
      const l = b.L[i] * mute; const r = b.R[i] * mute;
      mixL[i] += l; mixR[i] += r;
      verbIn[0][i] += l * vs + (b.VL ? b.VL[i] * g * e * mute : 0);
      verbIn[1][i] += r * vs + (b.VR ? b.VR[i] * g * e * mute : 0);
      delayIn[0][i] += l * ds + (b.DL ? b.DL[i] * g * e * mute : 0);
      delayIn[1][i] += r * ds + (b.DR ? b.DR[i] * g * e * mute : 0);
    }
    stats.push(b);
  }
  const rv = typeof o.reverb === 'string' ? REVERB[o.reverb] : { ...REVERB.hall, ...(o.reverb || {}) };
  const [vL, vR] = freeverb(verbIn[0], verbIn[1], rv);
  const [dL, dR] = pingpong(delayIn[0], delayIn[1], o.delay || {});
  const vg = dbToGain(bus('verb').opts.gain ?? 0); const dg = dbToGain(bus('delay').opts.gain ?? 0) * 0.8;
  const L = new Float32Array(n); const R = new Float32Array(n);
  const hpL = svf(); const hpR = svf(); const sideHp = svf();
  const eqL = (o.eq || []).map((e) => biquad(e.type || 'peak', e.f, e.g ?? 0, e.q ?? 0.8));
  const eqR = (o.eq || []).map((e) => biquad(e.type || 'peak', e.f, e.g ?? 0, e.q ?? 0.8));
  const mono = o.monoBass ?? 120;
  const glue = o.glue ?? 0.3;
  for (let i = 0; i < n; i++) {
    let l = mixL[i] + vL[i] * vg + dL[i] * dg;
    let r = mixR[i] + vR[i] * vg + dR[i] * dg;
    l = hpL(l, 25, 0.707).hp; r = hpR(r, 25, 0.707).hp;
    if (mono) { const m = (l + r) / 2; const s = sideHp((l - r) / 2, mono, 0.707).hp; l = m + s; r = m - s; }
    for (const f of eqL) l = f(l);
    for (const f of eqR) r = f(r);
    L[i] = l; R[i] = r;
  }
  // glue: gentle saturation relative to the mix's own peak level (character, softer transients)
  if (glue > 0) {
    let pk = 1e-9;
    for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    const k = 1 + glue * 1.5;
    for (let i = 0; i < n; i++) { L[i] = (Math.tanh((L[i] / pk) * k) / Math.tanh(k)) * pk; R[i] = (Math.tanh((R[i] / pk) * k) / Math.tanh(k)) * pk; }
  }
  // loudness normalisation + true-peak limiting, iterated
  const target = o.lufs ?? -14;
  const tpMax = o.truePeak ?? -1;
  let gain = target - loudness(L, R).I;
  let ceiling = tpMax - 0.3;
  let outL; let outR; let I; let tp; let gr;
  for (let it = 0; it < 6; it++) {
    outL = Float32Array.from(L, (x) => x * dbToGain(gain));
    outR = Float32Array.from(R, (x) => x * dbToGain(gain));
    gr = limit(outL, outR, ceiling);
    I = loudness(outL, outR).I;
    tp = truePeak(outL, outR);
    const okI = Math.abs(I - target) <= 0.2;
    // this estimator reads ~0.2 dB lower than ffmpeg's ebur128 on sharp transients: keep that margin
    const okT = tp <= tpMax - 0.2;
    if (okI && okT) break;
    if (!okT) ceiling -= tp - (tpMax - 0.2) + 0.05;
    if (!okI) gain += target - I;
  }
  // fades
  const fi = Math.floor(0.004 * SR); const fo = Math.floor((o.fadeOut ?? 0.25) * SR);
  for (let i = 0; i < fi; i++) { outL[i] *= i / fi; outR[i] *= i / fi; }
  for (let i = 0; i < fo; i++) { const k = n - 1 - i; const g = i / fo; outL[k] *= g; outR[k] *= g; }
  writeWav(file, outL, outR);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`wrote ${path.relative(process.cwd(), file)}  ${ctx.duration.toFixed(2)} s  ${I.toFixed(1)} LUFS  true peak ${tp.toFixed(2)} dBTP  limiter max ${gr.toFixed(1)} dB  (${secs} s)`);
  if (gr > 6) console.log(`note: the limiter pulls up to ${gr.toFixed(1)} dB — the loudest hits are much louder than the mix; lower the fx/drum hits or aim a lower LUFS`);
  if (o.report || process.argv.includes('--report')) report(stats, outL, outR, o.sections);
  return { I, tp, gr };
}

function report(stats, L, R, sections) {
  const lu = loudness(L, R);
  const wins = sections ? Object.entries(sections) : [['whole', [0, ctx.duration]]];
  console.log('bus balance (RMS dBFS after bus gain, before master) and master loudness per section:');
  console.log(`${''.padEnd(14)}${stats.map((b) => b.name.padStart(8)).join('')}   master LUFS`);
  for (const [name, [a, z]] of wins) {
    const i0 = Math.max(0, Math.floor(a * SR)); const i1 = Math.min(ctx.len, Math.floor(z * SR));
    const cells = stats.map((b) => {
      let s = 0;
      for (let i = i0; i < i1; i++) s += b.L[i] * b.L[i] + b.R[i] * b.R[i];
      const r = Math.sqrt(s / Math.max(1, (i1 - i0) * 2));
      return (r > 1e-6 ? gainToDb(r).toFixed(1) : '  -').padStart(8);
    });
    console.log(`${name.padEnd(14)}${cells.join('')}   ${lu.window(a, z).toFixed(1).padStart(6)}`);
  }
}

function writeWav(file, L, R) {
  const n = L.length;
  const data = Buffer.alloc(n * 6);
  let o = 0;
  for (let i = 0; i < n; i++) {
    for (const x of [L[i], R[i]]) {
      let v = Math.round(clamp(x, -1, 1) * 8388607);
      if (v < 0) v += 16777216;
      data[o++] = v & 255; data[o++] = (v >> 8) & 255; data[o++] = (v >> 16) & 255;
    }
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 6, 28); h.writeUInt16LE(6, 32); h.writeUInt16LE(24, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
