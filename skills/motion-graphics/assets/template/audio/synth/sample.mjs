// Recorded sounds the person supplies (a click, a crunch, their product's own chime): WAV files, placed on the same
// cues as the synth voices. A recording is loudest somewhere inside the file — a whoosh 0.7 s in, a click on its press —
// so by default a sample is placed with that peak on t, not its first byte. Prepare the files with tools/kit.mjs
// (converts any format to 48 kHz WAV and lists each file's peak); the person answers for their licence.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, writer, at } from './core.mjs';

const cache = new Map();
// a path like 'audio/kit/crunch.wav' is the project's, wherever the score is run from
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const locate = (file) => (path.isAbsolute(file) || fs.existsSync(file) ? file : path.join(ROOT, file));

/** Reads a PCM (8/16/24/32-bit) or 32-bit float WAV → { L, R, rate }. */
export function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file} is not a WAV file (convert it with tools/kit.mjs)`);
  let fmt = null;
  let data = null;
  for (let o = 12; o + 8 <= b.length;) {
    const id = b.toString('ascii', o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') {
      const format = b.readUInt16LE(o + 8);
      // WAVE_FORMAT_EXTENSIBLE keeps the real format in the first two bytes of its sub-format GUID
      fmt = { format: format === 0xfffe && size >= 26 ? b.readUInt16LE(o + 8 + 24) : format, ch: b.readUInt16LE(o + 10), rate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    } else if (id === 'data') data = b.subarray(o + 8, Math.min(b.length, o + 8 + size));
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`${file}: no fmt or data chunk`);
  if (fmt.format !== 1 && fmt.format !== 3) throw new Error(`${file}: WAV format ${fmt.format} — convert it with tools/kit.mjs`);
  const float = fmt.format === 3;
  if (float ? fmt.bits !== 32 : ![8, 16, 24, 32].includes(fmt.bits) || !fmt.ch) throw new Error(`${file}: ${fmt.bits}-bit ${float ? 'float' : 'PCM'} with ${fmt.ch} channels — convert it with tools/kit.mjs`);
  const step = fmt.bits / 8;
  const n = Math.floor(data.length / (step * fmt.ch));
  if (!n) throw new Error(`${file}: its data chunk holds no audio`);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const read = (o) => (float ? data.readFloatLE(o) : fmt.bits === 16 ? data.readInt16LE(o) / 32768 : fmt.bits === 24 ? data.readIntLE(o, 3) / 8388608 : fmt.bits === 32 ? data.readInt32LE(o) / 2147483648 : (data.readUInt8(o) - 128) / 128);
  for (let i = 0; i < n; i++) {
    const o = i * step * fmt.ch;
    L[i] = read(o);
    R[i] = fmt.ch > 1 ? read(o + step) : L[i];
  }
  return { L, R, rate: fmt.rate };
}
/** Seconds from the start of a recording to its loudest moment (5 ms RMS windows). */
export function peakOf({ L, R, rate }) {
  const w = Math.max(1, Math.round(rate * 0.005));
  let best = 0;
  let at0 = 0;
  for (let s = 0; s + w <= L.length; s += w) {
    let e = 0;
    for (let i = s; i < s + w; i++) e += L[i] * L[i] + R[i] * R[i];
    if (e > best) { best = e; at0 = s; }
  }
  return (at0 + w / 2) / rate;
}

function load(file) {
  if (!cache.has(file)) {
    const w = readWav(locate(file));
    cache.set(file, { ...w, peak: peakOf(w) });
  }
  return cache.get(file);
}

/**
 * Plays a recording at t. o: bus ('fx'), vel (gain, 1 = as recorded), pan, verb, delay, align ('peak' — its loudest
 * moment lands on t — or 'start'), rate (1 = as recorded; 0.9–1.1 varies a sound repeated many times), from (s into
 * the file), dur (s to play), fade (s of fade-out at the end of dur), fadeIn (s at the start — 10 ms by default when
 * `from` cuts into the recording, so the cut does not click).
 */
export function sample(t, file, o = {}) {
  const s = load(file);
  const rate = (o.rate ?? 1) * (s.rate / SR); // file samples per output sample
  const from = Math.max(0, (o.from ?? 0) * s.rate);
  const end = Math.min(s.L.length, o.dur ? from + o.dur * s.rate : s.L.length);
  const lead = o.align === 'start' ? 0 : Math.max(0, (s.peak * s.rate - from) / (s.rate * (o.rate ?? 1)));
  const w = writer(o.bus || 'fx', { pan: o.pan, verb: o.verb ?? 0, delay: o.delay, gain: o.vel ?? 1 });
  const i0 = at(t - lead);
  const fadeN = (o.fade ?? (o.dur ? 0.01 : 0)) * s.rate;
  const fadeInN = (o.fadeIn ?? (from > 0 ? 0.01 : 0)) * s.rate;
  for (let k = 0; ; k++) {
    const p = from + k * rate;
    if (p >= end - 1) break;
    const j = Math.floor(p);
    const f = p - j;
    const g = (fadeN > 0 && end - p < fadeN ? (end - p) / fadeN : 1) * (fadeInN > 0 && p - from < fadeInN ? (p - from) / fadeInN : 1);
    w(i0 + k, (s.L[j] + (s.L[j + 1] - s.L[j]) * f) * g, (s.R[j] + (s.R[j + 1] - s.R[j]) * f) * g);
  }
}
