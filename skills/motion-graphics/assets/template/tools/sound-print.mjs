#!/usr/bin/env node
// A score's fingerprint, to prove this video does not sound like the last one:
//  · tempo (the timeline's BPM, or estimated) · key (Krumhansl–Kessler over the chroma) · harmony (the chroma itself)
//  · groove: where the onsets fall in the bar, in three bands (kick / snare / hats), 16 steps each
//  · timbre: the average spectrum in 24 bands, level removed · density: onsets per second
// Compared with: the template's demo score (tools/demo-print.json), the other projects next to this one (their
// out/qa/*-print.json, or their out/music*.wav, analysed once and cached), and anything passed with --against.
//   node tools/sound-print.mjs [out/music.wav] [--against a.wav dir/ b-print.json …]
//   node tools/sound-print.mjs --list [folder]      the promos in a folder (default: next to this project), before
//                                                     choosing a genre: their tempo, key and groove
//   node tools/sound-print.mjs --suggest "<brand>" --world <row> [--in folder]   a starting card, tempo, key and kit
//                                                     for this brand, away from what the folder already holds
// tools/audio-check.mjs runs it too. As a module: printOf(file, { bpm }), compare(a, b), neighbours(root).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SR = 22050;
export const VERSION = 2; // bump when the analysis changes: older prints and caches are recomputed
const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len; const wr = Math.cos(a); const wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1; let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const h = i + k + len / 2;
        const vr = re[h] * cr - im[h] * ci; const vi = re[h] * ci + im[h] * cr;
        re[h] = re[i + k] - vr; im[h] = im[i + k] - vi; re[i + k] += vr; im[i + k] += vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
// magnitude spectra of hann-windowed frames
function stft(x, N, hop, each) {
  const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const re = new Float64Array(N); const im = new Float64Array(N); const mag = new Float64Array(N / 2);
  const frames = Math.max(0, Math.floor((x.length - N) / hop) + 1);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { re[i] = x[f * hop + i] * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    each(mag, f);
  }
  return frames;
}
const norm = (v) => { const s = Math.hypot(...v) || 1; return v.map((x) => x / s); };
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const pearson = (a, b) => {
  const ma = a.reduce((s, x) => s + x, 0) / a.length; const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let sab = 0; let saa = 0; let sbb = 0;
  for (let i = 0; i < a.length; i++) { const p = a[i] - ma; const q = b[i] - mb; sab += p * q; saa += p * p; sbb += q * q; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
};
const r3 = (v) => Math.round(v * 1000) / 1000;

export function printOf(file, { bpm: givenBpm = null, label = null } = {}) {
  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 }).stdout;
  if (!pcm || pcm.length < SR * 4 * 4) throw new Error(`${file}: no audio, or shorter than 4 s`);
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength >> 2);
  const duration = x.length / SR;

  // chroma + timbre from long frames (186 ms: semitones resolve down to ~110 Hz)
  const NL = 4096; const binHz = SR / NL;
  const chroma = new Array(12).fill(0);
  const EDGES = Array.from({ length: 25 }, (_, i) => 40 * (11000 / 40) ** (i / 24));
  const bandOf = new Int16Array(NL / 2).fill(-1);
  for (let k = 1; k < NL / 2; k++) { const f = k * binHz; for (let b = 0; b < 24; b++) if (f >= EDGES[b] && f < EDGES[b + 1]) bandOf[k] = b; }
  const bandPow = new Array(24).fill(0);
  let loudFrames = 0;
  stft(x, NL, NL / 2, (mag) => {
    let e = 0;
    for (let k = 1; k < NL / 2; k++) e += mag[k] * mag[k];
    if (e < 1e-6) return; // silence says nothing about harmony or timbre
    loudFrames++;
    const c = new Array(12).fill(0);
    for (let k = Math.ceil(110 / binHz); k < Math.min(NL / 2, 5000 / binHz); k++) {
      const midi = 69 + 12 * Math.log2((k * binHz) / 440);
      c[((Math.round(midi) % 12) + 12) % 12] += mag[k];
    }
    const cs = c.reduce((s, v) => s + v, 0) || 1;
    for (let i = 0; i < 12; i++) chroma[i] += c[i] / cs;
    for (let k = 1; k < NL / 2; k++) if (bandOf[k] >= 0) bandPow[bandOf[k]] += (mag[k] * mag[k]) / e;
  });
  const chromaN = chroma.map((v) => v / (loudFrames || 1));
  let key = { r: -2 };
  for (let t = 0; t < 12; t++) for (const [mode, prof] of [['major', KK_MAJOR], ['minor', KK_MINOR]]) {
    const r = pearson(chromaN, prof.map((_, i) => prof[(i - t + 12) % 12]));
    if (r > key.r) key = { r, tonic: t, mode };
  }
  const tdb = bandPow.map((p) => 10 * Math.log10(p / (loudFrames || 1) + 1e-12));
  const tMean = tdb.reduce((s, v) => s + v, 0) / 24;
  const timbre = tdb.map((v) => v - tMean);

  // onsets in three bands from short frames (23 ms at hop 256 → 11.6 ms)
  const NS = 1024; const HOP = 256; const hopT = HOP / SR;
  const BANDS = [[30, 180], [180, 2500], [2500, 10000]];
  const binsOf = BANDS.map(([lo, hi]) => [Math.max(1, Math.round(lo / (SR / NS))), Math.min(NS / 2 - 1, Math.round(hi / (SR / NS)))]);
  const flux = BANDS.map(() => []);
  let prev = null;
  stft(x, NS, HOP, (mag) => {
    const lm = Array.from(mag, (m) => Math.log1p(100 * m));
    binsOf.forEach(([a, z], b) => { let s = 0; if (prev) for (let k = a; k <= z; k++) { const d = lm[k] - prev[k]; if (d > 0) s += d; } flux[b].push(s); });
    prev = lm;
  });
  const frames = flux[0].length;
  const envOf = (fl) => { // rises above a 0.5 s moving average
    const m = Math.round(0.5 / hopT); const env = new Float64Array(fl.length); let acc = 0;
    for (let i = 0; i < fl.length; i++) { acc += fl[i]; if (i >= m) acc -= fl[i - m]; env[i] = Math.max(0, fl[i] - acc / Math.min(i + 1, m)); }
    return env;
  };
  const env = flux.map(envOf);
  const all = new Float64Array(frames).map((_, i) => env[0][i] + env[1][i] + env[2][i]);

  // tempo: the timeline's when known, else autocorrelation with a prior around 120 BPM
  let bpm = givenBpm; let bpmSource = 'timeline';
  if (!bpm) {
    bpmSource = 'estimate';
    let best = { s: -1, bpm: 120 };
    for (let b = 70; b <= 180; b += 0.25) {
      const lag = 60 / b / hopT; const l0 = Math.floor(lag); const fr = lag - l0;
      let s = 0;
      for (let i = 0; i + l0 + 1 < frames; i++) s += all[i] * (all[i + l0] * (1 - fr) + all[i + l0 + 1] * fr);
      s *= Math.exp(-0.5 * (Math.log2(b / 120) / 0.9) ** 2);
      if (s > best.s) best = { s, bpm: b };
    }
    // refine: the true tempo folds the onsets into the sharpest beat histogram (a wrong one drifts and smears it);
    // the autocorrelation alone leans to whole-frame lags (128 reads as 129.3)
    let sharp = { s: -1, bpm: best.bpm };
    for (let b = best.bpm - 3; b <= best.bpm + 3; b += 0.05) {
      const P = 60 / b / hopT; const H = new Float64Array(32);
      for (let i = 0; i < frames; i++) H[Math.floor(((i % P) / P) * 32) % 32] += all[i];
      const tot = H.reduce((s, v) => s + v, 0) || 1;
      const s = H.reduce((acc, v) => acc + (v / tot) ** 2, 0);
      if (s > sharp.s) sharp = { s, bpm: b };
    }
    bpm = sharp.bpm;
  }
  // groove: fold each band's onsets onto 16 steps of a bar. Without a timeline the beat is where the kicks land
  // (the low band): the summed onsets would pick the off-beat in house, where hats and bass are louder
  const step = 60 / bpm / 4 / hopT; // frames per 16th
  let phase = 0;
  if (bpmSource === 'estimate') {
    const low = env[0].some((v) => v > 0) ? env[0] : all;
    let bestS = -1;
    for (let off = 0; off < step * 4; off += 0.5) { let s = 0; for (let p = off; p < frames; p += step * 4) s += low[Math.round(p)] || 0; if (s > bestS) { bestS = s; phase = off; } }
  }
  const groove = env.map((e) => {
    const g = new Array(16).fill(0);
    for (let i = 0; i < frames; i++) { const pos = (i - phase) / step; const k = Math.round(pos); if (Math.abs(pos - k) < 0.35) g[((k % 16) + 16) % 16] += e[i]; }
    const s = g.reduce((a, v) => a + v, 0) || 1;
    return g.map((v) => r3(v / s));
  });
  // onsets per second: peaks of the summed envelope above its mean + 1 sd, at least 60 ms apart
  const mean = all.reduce((s, v) => s + v, 0) / frames;
  const sd = Math.sqrt(all.reduce((s, v) => s + (v - mean) ** 2, 0) / frames);
  let onsets = 0; let last = -1e9;
  for (let i = 1; i < frames - 1; i++) if (all[i] > mean + sd && all[i] >= all[i - 1] && all[i] >= all[i + 1] && (i - last) * hopT > 0.06) { onsets++; last = i; }

  return {
    version: VERSION, label: label || path.basename(file), file: path.resolve(file), duration: r3(duration),
    bpm: Math.round(bpm * 10) / 10, bpmSource,
    key: `${NOTES[key.tonic]} ${key.mode}`, tonic: key.tonic, mode: key.mode, keyR: r3(key.r),
    chroma: chromaN.map(r3), groove: { low: groove[0], mid: groove[1], high: groove[2] },
    timbre: timbre.map((v) => Math.round(v * 10) / 10), density: Math.round((onsets / duration) * 10) / 10,
  };
}

// the groove in words, from the low band (kick and bass together — a bass bouncing on every beat pumps like a kick)
// and the hats
export function grooveName(p) {
  const L = p.groove.low; const Hh = p.groove.high;
  const beats = [0, 4, 8, 12].map((i) => L[i]);
  const onBeats = beats.reduce((s, v) => s + v, 0);
  let kick = 'broken low end';
  if (onBeats >= 0.5 && Math.min(...beats) >= 0.07) kick = 'low end on every beat';
  else if (L[0] + L[8] >= 0.35 && L[4] + L[12] < 0.12) kick = 'half-time low end';
  else if (Math.max(...L) < 0.12) kick = 'no clear low end';
  const offHats = [2, 6, 10, 14].reduce((s, i) => s + Hh[i], 0) >= 0.35;
  return `${kick}${offHats ? ', off-beat hats' : ''}, ${p.density} onsets/s`;
}

// 0 … 1 per trait; the score is the core of how a track sounds: groove (where kick, snare and hats fall), timbre (the
// kit and the instruments) and tempo. Key and chords are reported but left out of the score: new chords over the same
// kit, groove and tempo still sound like the same track — the very complaint this check was built for.
export function compare(a, b) {
  // tempo by ratio (half / double time count as the same pulse): ≤ 2.5 % apart is the same, 15 % apart is different
  const tempoD = Math.min(...[b.bpm, b.bpm * 2, b.bpm / 2].map((x) => Math.abs(Math.log2(a.bpm / x))));
  const tempo = Math.max(0, Math.min(1, 1 - (tempoD - 0.036) / (0.2 - 0.036)));
  const rel = (x) => (x.mode === 'minor' ? x.tonic : (x.tonic + 9) % 12); // relative minor's tonic
  const tonal = Math.min(a.keyR, b.keyR) >= 0.5;
  const key = !tonal ? 0.5 : a.tonic === b.tonic && a.mode === b.mode ? 1 : rel(a) === rel(b) ? 0.7 : a.tonic === b.tonic ? 0.3 : 0;
  const shifts = [0, 2, 4, 6, 8, 10, 12, 14]; // a bar read from any beat, or an eighth off (a guessed phase)
  const rot = (v, s) => v.map((_, i) => v[(i + s) % 16]);
  const groove = Math.max(0, Math.max(...shifts.map((s) => (pearson(a.groove.low, rot(b.groove.low, s)) * 0.45
    + pearson(a.groove.mid, rot(b.groove.mid, s)) * 0.3 + pearson(a.groove.high, rot(b.groove.high, s)) * 0.25))));
  const td = Math.sqrt(a.timbre.reduce((s, v, i) => s + (v - b.timbre[i]) ** 2, 0) / 24);
  const timbre = Math.max(0, Math.min(1, 1 - (td - 1.5) / 4.5));
  const chroma = Math.max(0, Math.min(1, (dot(norm(a.chroma), norm(b.chroma)) - 0.75) / 0.25));
  const score = 0.35 * groove + 0.35 * timbre + 0.3 * tempo;
  const same = [];
  if (tempo >= 0.9) same.push(`tempo ${a.bpm}≈${b.bpm}`);
  if (key >= 0.7) same.push(key === 1 ? `key ${a.key}` : `relative keys ${a.key} / ${b.key}`);
  if (groove >= 0.8) same.push(`groove r ${groove.toFixed(2)}`);
  if (timbre >= 0.7) same.push(`timbre Δ ${td.toFixed(1)} dB`);
  if (chroma >= 0.8) same.push('chord colours');
  return { score: r3(score), traits: { tempo: r3(tempo), key: r3(key), groove: r3(groove), timbre: r3(timbre), chroma: r3(chroma) }, same };
}

// other scores to compare with: the template demo, the projects next to this one, extra paths
// analyses are cached in the project; the template inside the skill itself (<skill>/assets/template) caches in the
// system temp folder, so running the tool from the skill never writes into it
export const cacheHome = (root) => (fs.existsSync(path.join(root, '..', '..', 'SKILL.md'))
  ? path.join(os.tmpdir(), 'motion-graphics-prints') : path.join(root, '.cache', 'prints'));

export function neighbours(root, extra = [], { cacheDir = cacheHome(root) } = {}) {
  const out = [];
  const demo = path.join(root, 'tools', 'demo-print.json');
  if (fs.existsSync(demo)) out.push({ ...JSON.parse(fs.readFileSync(demo, 'utf8')), label: 'the template demo score' });
  const cached = (file) => { // analyse a wav once; the cache key is its path, size and time
    const st = fs.statSync(file);
    const id = crypto.createHash('sha1').update(`${VERSION}|${path.resolve(file)}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0, 16);
    const c = path.join(cacheDir, `${id}.json`);
    if (fs.existsSync(c)) return JSON.parse(fs.readFileSync(c, 'utf8'));
    const p = printOf(file);
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(c, JSON.stringify(p));
    return p;
  };
  const fromProject = (dir) => {
    const qa = path.join(dir, 'out', 'qa');
    const prints = (fs.existsSync(qa) ? fs.readdirSync(qa).filter((f) => f.endsWith('-print.json')) : [])
      .map((f) => JSON.parse(fs.readFileSync(path.join(qa, f), 'utf8'))).filter((p) => p.version === VERSION);
    if (prints.length) return [{ ...prints[0], label: path.basename(dir) }];
    const o = path.join(dir, 'out');
    const wav = fs.existsSync(o) ? fs.readdirSync(o).filter((f) => /^music.*\.wav$/i.test(f)).sort()[0] : null;
    return wav ? [{ ...cached(path.join(o, wav)), label: path.basename(dir) }] : [];
  };
  const parent = path.dirname(root);
  let sibs = [];
  try { sibs = fs.readdirSync(parent, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(parent, d.name)); } catch { /* unreadable parent */ }
  sibs = sibs.filter((d) => path.resolve(d) !== path.resolve(root) && fs.existsSync(path.join(d, 'out')))
    .map((d) => ({ d, t: fs.statSync(path.join(d, 'out')).mtimeMs })).sort((p, q) => q.t - p.t).slice(0, 16).map((p) => p.d);
  for (const d of sibs) { try { out.push(...fromProject(d)); } catch (e) { console.error(`skip ${d}: ${e.message}`); } }
  for (const e of extra) {
    const p = path.resolve(e);
    if (!fs.existsSync(p)) { console.error(`no ${e}`); continue; }
    if (fs.statSync(p).isDirectory()) {
      const found = fromProject(p);
      if (found.length) out.push(...found);
      else for (const f of fs.readdirSync(p).filter((n) => /\.(wav|mp3|m4a|flac|ogg|mp4|mov)$/i.test(n))) out.push({ ...cached(path.join(p, f)), label: f });
    } else out.push(p.endsWith('.json') ? JSON.parse(fs.readFileSync(p, 'utf8')) : cached(p));
  }
  return out;
}

// calibrated on six promo scores made from one synth kit, which their author heard as "about the same everywhere":
// the five house-like ones scored 0.74–0.96 with each other, the one in another style 0.56–0.72 with the rest;
// a copy of a score with new chords stays above 0.85
export const SAME = 0.85;
export const TOO_CLOSE = 0.75;
export const CLOSE = 0.65;

// this project's score against the others: { level: PASS | WARN | FAIL | INFO, detail, near: [{ o, c }] }
export function verdict(me, root, extra = []) {
  const near = neighbours(root, extra).filter((o) => path.resolve(o.file || '') !== path.resolve(me.file))
    .map((o) => ({ o, c: compare(me, o) })).sort((p, q) => q.c.score - p.c.score);
  const top = near[0];
  if (!top) return { level: 'INFO', detail: 'nothing to compare with', near };
  const same = top.c.same.length ? `: same ${top.c.same.join(', ')}` : '';
  // the demo score fails whatever else is nearer (a sibling project that also kept it must not hide it)
  const demo = near.find((p) => p.o.label === 'the template demo score');
  if (demo && demo.c.score >= SAME) {
    return { level: 'FAIL', detail: `${demo.c.score.toFixed(2)} to the template's demo score — compose this video's own (references/sound-design.md)`, near };
  }
  if (top.c.score >= TOO_CLOSE) {
    return { level: 'WARN', detail: `${top.c.score.toFixed(2)} to ${top.o.label}${same} — change the genre, the groove or the kit unless a matching series was asked for (sound-design.md §12)`, near };
  }
  return { level: 'PASS', detail: `nearest ${top.o.label} at ${top.c.score.toFixed(2)} (≥ ${TOO_CLOSE} would be too close)`, near };
}

// ---- suggest: a starting genre, tempo, key and kit for a brand ------------------------------------------------------------
// The brand table (sound-design.md §3) lists typical options in the same order for every brand of a kind; a model
// takes the first one, so a hundred SaaS promos would open with the same card. The brand's name rotates the options
// (stable for one brand, spread across brands), four on the floor stays last outside nightlife, and what the folder
// already holds (families, keys, tempos) is moved out of the way.
// energy: 1 calm (no kick, ambient, lo-fi) · 2 steady (a groove that leaves room) · 3 driving (the full groove, fast
// or hard). Every row has at least two cards (outside four on the floor) at every energy, so the brand's name still
// rotates the first one whatever the energy. home: the energy of a brand of this kind when the person asked for none —
// their words (--energy) win. 'half-time' is a groove whose snare sits on 3: it feels like half the BPM.
const C = (card, name, family, lo, hi, modes, energy) => ({ card, name, family, lo, hi, modes, energy });
const WORLDS = {
  cars: { home: 3, kit: ['hard, loud'], options: [C(1, 'Drift phonk', 'backbeat', 128, 145, 'minor', 3), C(2, 'Trap', 'half-time', 130, 150, 'minor', 2),
    C(11, 'Drum & bass', 'broken', 170, 176, 'minor', 3), C(18, 'Rock-ish hybrid', 'backbeat', 130, 150, 'minor mixolydian', 3),
    C(21, 'Baile funk', 'broken', 125, 135, 'minor', 3), C(22, 'Hyperpop / glitch-pop', 'half-time', 140, 170, 'major minor', 2),
    C(17, 'Night-drive ambient (a premium car film)', 'no kick', 70, 90, 'minor lydian', 1), C(8, 'Lo-fi night drive', 'backbeat', 75, 90, 'minor', 1)] },
  tech: { home: 2, kit: ['clean, precise'], options: [C(14, 'Minimal pulse (no kick or half-time)', 'no kick', 90, 110, 'major minor', 1),
    C(22, 'Glitch-pop', 'half-time', 140, 170, 'major minor', 2), C(12, 'UK garage', 'broken', 130, 134, 'minor', 2),
    C(11, 'Liquid drum & bass', 'broken', 170, 176, 'minor', 3), C(7, 'Synthwave', 'backbeat', 90, 118, 'minor', 2),
    C(18, 'Rock-ish hybrid (a launch with guitar-like leads)', 'backbeat', 130, 150, 'minor mixolydian', 3),
    C(19, 'Breakbeat', 'broken', 125, 140, 'minor mixolydian', 3), C(17, 'Ambient pulse (a calm product film)', 'no kick', 70, 95, 'lydian major', 1),
    C(3, 'Tech house', 'four on the floor', 120, 126, 'minor dorian', 3)] },
  apps: { home: 2, kit: ['clean, precise', 'bouncy club'], options: [C(6, 'Future bass', 'half-time', 140, 160, 'major', 2),
    C(19, 'Breakbeat', 'broken', 125, 140, 'minor mixolydian', 3), C(12, 'UK garage', 'broken', 130, 134, 'minor', 2),
    C(20, 'Jersey club', 'broken', 135, 145, 'minor', 3), C(15, 'Playful pop (backbeat)', 'backbeat', 100, 125, 'major', 2),
    C(8, 'Lo-fi (a calm, cozy app)', 'backbeat', 75, 90, 'major', 1), C(17, 'Ambient pulse', 'no kick', 70, 95, 'major lydian', 1),
    C(5, 'Nu-disco', 'four on the floor', 110, 122, 'major dorian', 2)] },
  food: { home: 2, kit: ['warm, round', 'dusty'], options: [C(8, 'Lo-fi hip-hop (swing)', 'backbeat', 75, 90, 'major', 1),
    C(5, 'Funk / boogie (backbeat)', 'backbeat', 95, 112, 'dorian major', 2), C(10, 'Latin / bossa groove', 'broken', 90, 100, 'minor', 1),
    C(9, 'Amapiano (log drums, the kick drops beats)', 'broken', 112, 118, 'minor major', 2),
    C(18, 'Rock-ish hybrid (burgers, street food)', 'backbeat', 130, 150, 'minor mixolydian', 3),
    C(10, 'Latin / dembow (tacos, street food)', 'broken', 90, 100, 'minor', 3), C(5, 'Nu-disco', 'four on the floor', 110, 122, 'major', 2)] },
  beauty: { home: 1, kit: ['clean, precise', 'warm, round'], options: [C(17, 'Luxury ambient', 'no kick', 60, 95, 'lydian major', 1),
    C(9, 'Amapiano (log drums)', 'broken', 112, 118, 'minor major', 2), C(12, 'UK garage', 'broken', 130, 134, 'minor', 2),
    C(2, 'Trap (fashion)', 'half-time', 130, 150, 'minor', 2), C(19, 'Big-beat breaks (fashion)', 'broken', 120, 135, 'minor', 3),
    C(14, 'Minimal pulse without its kick', 'no kick', 90, 110, 'major', 1), C(11, 'Liquid drum & bass (a fashion film)', 'broken', 170, 176, 'minor', 3),
    C(4, 'Deep house', 'four on the floor', 118, 122, 'minor', 2)] },
  kids: { home: 2, kit: ['warm, round'], options: [C(15, 'Marimba / kalimba pop (backbeat)', 'backbeat', 100, 125, 'major', 2),
    C(16, 'Chiptune', 'backbeat', 120, 150, 'major minor', 3), C(19, 'Bouncy breakbeat with toy sounds', 'broken', 125, 135, 'major mixolydian', 3),
    C(6, 'Future bass (sugary)', 'half-time', 140, 160, 'major', 2), C(8, 'Soft lo-fi (bedtime)', 'backbeat', 75, 90, 'major', 1),
    C(17, 'Music-box ambient (a lullaby)', 'no kick', 70, 90, 'major lydian', 1)] },
  b2b: { home: 2, kit: ['big, cinematic', 'clean, precise'], options: [C(13, 'Cinematic hybrid', 'broken', 80, 100, 'minor', 2),
    C(14, 'Minimal pulse', 'no kick', 90, 110, 'major minor', 1), C(19, 'Driving breakbeat', 'broken', 125, 135, 'minor', 3),
    C(7, 'Synthwave', 'backbeat', 90, 118, 'minor', 2), C(17, 'Ambient pulse (trust, calm)', 'no kick', 70, 95, 'major lydian', 1),
    C(18, 'Rock-ish hybrid (industry, power)', 'backbeat', 130, 150, 'minor mixolydian', 3)] },
  health: { home: 1, kit: ['warm, round'], options: [C(17, 'Ambient pulse', 'no kick', 70, 90, 'lydian major', 1),
    C(14, 'Minimal pulse without its kick', 'no kick', 90, 110, 'major', 1), C(8, 'Soft lo-fi', 'backbeat', 75, 90, 'major', 1),
    C(15, 'Gentle backbeat pop (wellness)', 'backbeat', 95, 115, 'major', 2), C(9, 'Amapiano, easy (wellness)', 'broken', 110, 116, 'major minor', 2),
    C(19, 'Driving breakbeat (fitness, sport)', 'broken', 125, 140, 'minor mixolydian', 3), C(11, 'Drum & bass (running, cycling)', 'broken', 170, 176, 'minor', 3)] },
  nightlife: { home: 3, kit: ['bouncy club', 'hard, loud'], club: true, options: [C(3, 'House / techno', 'four on the floor', 122, 130, 'minor dorian', 3),
    C(12, 'UK garage', 'broken', 130, 134, 'minor', 2), C(20, 'Jersey club', 'broken', 135, 145, 'minor', 3),
    C(21, 'Baile funk', 'broken', 125, 135, 'minor', 3), C(4, 'Deep house', 'four on the floor', 118, 122, 'minor', 2),
    C(17, 'Lounge ambient (a rooftop at dawn)', 'no kick', 80, 100, 'minor lydian', 1), C(8, 'Lo-fi lounge', 'backbeat', 80, 92, 'minor', 1)] },
  regional: { home: 2, kit: ['warm, round'], options: [C(10, 'Latin / dembow', 'broken', 90, 100, 'minor', 3),
    C(9, 'Afro / amapiano', 'broken', 100, 118, 'minor major', 2), C(15, 'Pentatonic plucks (koto = pluck ks)', 'backbeat', 90, 120, 'major', 1),
    C(21, 'Baile funk', 'broken', 125, 135, 'minor', 3), C(5, 'Brass funk (a regional band sound)', 'backbeat', 100, 118, 'minor dorian', 2),
    C(17, 'Ambient with a regional voice (duduk = formant, koto = pluck ks)', 'no kick', 70, 95, 'minor lydian', 1)] },
  // developer tools, open source, CLIs, APIs: clean and precise, and driving by default (the release films drive)
  dev: { home: 3, kit: ['clean, precise'], options: [C(19, 'Breakbeat (a release film)', 'broken', 125, 135, 'minor mixolydian', 3),
    C(12, 'UK garage', 'broken', 130, 134, 'minor', 2), C(11, 'Liquid drum & bass', 'broken', 170, 176, 'minor', 3),
    C(7, 'Synthwave (a terminal at night)', 'backbeat', 100, 118, 'minor', 2), C(18, 'Rock-ish hybrid (a big major version)', 'backbeat', 130, 150, 'minor mixolydian', 3),
    C(22, 'Glitch-pop', 'half-time', 140, 160, 'minor', 2), C(14, 'Minimal pulse without its kick (docs, a calm explainer)', 'no kick', 90, 110, 'minor', 1),
    C(17, 'Ambient pulse', 'no kick', 70, 95, 'lydian', 1), C(3, 'Tech house', 'four on the floor', 122, 126, 'minor', 3)] },
  // travel, sport, events, personal reels: music-led, cut on the downbeats
  lifestyle: { home: 3, kit: ['hard, loud', 'warm, round'], options: [C(19, 'Breakbeat (whip pans between places)', 'broken', 120, 135, 'minor mixolydian', 3),
    C(21, 'Baile funk', 'broken', 125, 135, 'minor', 3), C(1, 'Drift phonk (night, speed)', 'backbeat', 128, 145, 'minor', 3),
    C(9, 'Afro / amapiano (summer, the sea)', 'broken', 110, 118, 'minor major', 2), C(6, 'Future bass (a sunrise)', 'half-time', 140, 150, 'major', 2),
    C(15, 'Uplifting pop (backbeat)', 'backbeat', 110, 125, 'major', 2), C(8, 'Lo-fi (a slow travel diary)', 'backbeat', 75, 90, 'major', 1),
    C(17, 'Ambient (landscapes, a quiet morning)', 'no kick', 70, 90, 'lydian major', 1), C(5, 'Nu-disco', 'four on the floor', 115, 122, 'major', 2)] },
};
// A minor and C major are what models write when nobody chooses: left out of the suggestions
const KEYS = {
  minor: ['F minor', 'B♭ minor', 'C♯ minor', 'G minor', 'D minor', 'E minor', 'B minor', 'F♯ minor', 'C minor', 'E♭ minor'],
  major: ['D major', 'E major', 'E♭ major', 'B♭ major', 'F major', 'G major', 'A♭ major', 'A major'],
  dorian: ['D dorian', 'E dorian', 'G dorian', 'F♯ dorian'], mixolydian: ['G mixolydian', 'D mixolydian', 'A mixolydian'],
  lydian: ['F lydian', 'D lydian', 'E♭ lydian'],
};
const familyOf = (p) => { const g = grooveName(p); return g.startsWith('low end on every beat') ? 'four on the floor' : g.startsWith('half-time') ? 'half-time' : g.startsWith('no clear') ? 'no kick' : 'broken'; };

export const ENERGIES = { low: 1, mid: 2, high: 3 };
// energy: the person's words ('low' | 'mid' | 'high'); without it the world's own energy (home) decides
export function suggest(brand, world, earlier = [], { energy = null } = {}) {
  const w = WORLDS[world];
  if (!w) throw new Error(`--world is one of: ${Object.keys(WORLDS).join(', ')}`);
  if (energy && !ENERGIES[energy]) throw new Error(`--energy is one of: ${Object.keys(ENERGIES).join(', ')}`);
  const want = energy ? ENERGIES[energy] : w.home;
  const tol = energy ? 0 : 1; // the person's words are exact; the topic's own energy lets a neighbouring level tie
  const off = (o) => Math.max(0, Math.abs(o.energy - want) - tol);
  const h = crypto.createHash('sha1').update(String(brand).trim().toLowerCase()).digest();
  const usedFam = new Map();
  for (const p of earlier) usedFam.set(familyOf(p), (usedFam.get(familyOf(p)) || 0) + 1);
  const usedKeys = new Set(earlier.map((p) => p.key));
  const usedBpm = earlier.map((p) => p.bpm);
  // within what ties, each card's own hash with the brand's name decides: a stable order per brand, spread evenly
  // across brands however many cards tie (a rotation of the list rarely swaps two neighbours)
  const draw = (o) => crypto.createHash('sha1').update(`${String(brand).trim().toLowerCase()}|${o.card}|${o.name}`).digest().readUInt32BE(0);
  const order = w.options.map((o) => ({ o, k: draw(o) }))
    .sort((a, b) => (!w.club && a.o.family === 'four on the floor') - (!w.club && b.o.family === 'four on the floor') // 4/4 last
      || off(a.o) - off(b.o) // the asked-for energy first
      || (usedFam.get(a.o.family) || 0) - (usedFam.get(b.o.family) || 0) || a.k - b.k)
    .map((x) => x.o);
  return {
    energy: Object.keys(ENERGIES).find((k) => ENERGIES[k] === want), fromWords: !!energy,
    kit: w.kit[h[1] % w.kit.length], seed: h.readUInt16BE(2),
    options: order.map((o, n) => {
      const modes = o.modes.split(' ');
      const pool = KEYS[modes[(h[4 + n] >> 4) % modes.length]].filter((k) => !usedKeys.has(k.replace('♭', 'b').replace('♯', '#')));
      const key = pool[h[5 + n] % pool.length] || KEYS[modes[0]][0];
      let bpm = o.lo + (h[8 + n] % (o.hi - o.lo + 1));
      for (let k = 0; k < 8 && usedBpm.some((b) => Math.abs(Math.log2(bpm / b)) < 0.036); k++) bpm = o.lo + ((bpm - o.lo + 5) % (o.hi - o.lo + 1));
      return { ...o, key, bpm };
    }),
  };
}

// run as a command (compared as real paths: a symlink or a junction in the path must not turn the CLI off)
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const si = args.indexOf('--suggest');
  if (si >= 0) { // node tools/sound-print.mjs --suggest "<brand>" --world <row> [--energy low|mid|high] [--in <folder of earlier promos>]
    const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
    const brand = args[si + 1];
    if (!brand || brand.startsWith('--') || !opt('world')) {
      console.log(`usage: node tools/sound-print.mjs --suggest "<brand>" --world <${Object.keys(WORLDS).join('|')}> [--energy low|mid|high] [--in <folder>]`);
      process.exit(1);
    }
    if (!WORLDS[opt('world')]) { console.error(`--world is one of: ${Object.keys(WORLDS).join(', ')}`); process.exit(1); }
    if (args.includes('--energy') && !ENERGIES[opt('energy')]) { console.error(`--energy is one of: ${Object.keys(ENERGIES).join(', ')} (from the person's words; without it the world's own energy decides)`); process.exit(1); }
    const earlier = opt('in') ? neighbours(path.join(path.resolve(opt('in')), '.none'), [], { cacheDir: cacheHome(ROOT) }).filter((p) => p.label !== 'the template demo score') : [];
    const s = suggest(brand, opt('world'), earlier, { energy: opt('energy') });
    const level = ['', 'calm', 'steady', 'driving'];
    console.log(`Sound for «${brand}» (${opt('world')}, energy ${s.energy} — ${s.fromWords ? 'from the person\'s words' : 'the topic\'s own: pass --energy when the person said how it should feel'}): a start, not a verdict — the user's words, the references and the edit win.`);
    s.options.forEach((o, n) => console.log(`  ${n === 0 ? '→' : ' '} card ${String(o.card).padStart(2)} ${o.name} — ${o.family}, ${o.bpm} BPM${o.family === 'half-time' ? ` (feels ${Math.round(o.bpm / 2)})` : ''}, ${o.key}, ${level[o.energy]}${o.family === 'four on the floor' && !WORLDS[opt('world')].club ? '  (only for a club-minded brand)' : ''}`));
    console.log(`  kit character: ${s.kit} (sound-design.md §3) · A.init seed ${s.seed}`);
    if (earlier.length) console.log(`  moved out of the way: ${earlier.length} earlier promo(s) — ${[...new Set(earlier.map(familyOf))].join(', ')}; keys ${[...new Set(earlier.map((p) => p.key))].join(', ')}`);
    process.exit(0);
  }
  const li = args.indexOf('--list');
  if (li >= 0) { // what the earlier promos sound like, before choosing this one's genre
    const dir = args[li + 1] && !args[li + 1].startsWith('--') ? path.resolve(args[li + 1]) : path.dirname(ROOT);
    const found = neighbours(path.join(dir, '.none'), [], { cacheDir: cacheHome(ROOT) });
    for (const p of found) console.log(`${p.label.padEnd(28)} ${String(p.bpm).padStart(6)} BPM  ${p.key.padEnd(9)} ${grooveName(p)}`);
    if (!found.length) console.log(`no promo projects with out/music*.wav in ${dir}`);
    process.exit(0);
  }
  const ai = args.indexOf('--against');
  const against = ai >= 0 ? args.slice(ai + 1).filter((a) => !a.startsWith('--')) : [];
  const given = args.find((a, i) => !a.startsWith('--') && (ai < 0 || i < ai));
  const file = given ? path.resolve(given) : path.join(ROOT, 'out/music.wav');
  if (!fs.existsSync(file)) { console.error(`no ${file} — run node audio/score.mjs first`); process.exit(1); }
  let bpm = null;
  try { bpm = (await import(pathToFileURL(path.join(ROOT, 'js/timeline.mjs')).href)).BPM; } catch { /* a bare wav */ }
  const inProject = path.resolve(file).startsWith(path.join(ROOT, 'out'));
  const me = printOf(file, { bpm: inProject ? bpm : null });
  if (inProject) {
    fs.mkdirSync(path.join(ROOT, 'out', 'qa'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'out', 'qa', `${path.basename(file).replace(/\.\w+$/, '')}-print.json`), JSON.stringify(me, null, 1));
  }
  console.log(`${me.label}: ${me.bpm} BPM (${me.bpmSource}), ${me.key} (r ${me.keyR}), ${me.density} onsets/s`);
  const others = neighbours(ROOT, against).filter((o) => path.resolve(o.file || '') !== path.resolve(file));
  const rows = others.map((o) => ({ o, c: compare(me, o) })).sort((p, q) => q.c.score - p.c.score);
  for (const { o, c } of rows) {
    const verdict = c.score >= TOO_CLOSE ? 'TOO CLOSE' : c.score >= CLOSE ? 'close' : 'distinct';
    console.log(`  ${c.score.toFixed(2)} ${verdict.padEnd(9)} ${o.label} (${o.bpm} BPM, ${o.key})${c.same.length ? ` — same: ${c.same.join(', ')}` : ''}`);
  }
  if (!rows.length) console.log('  nothing to compare with (no demo print, no projects next to this one)');
}
