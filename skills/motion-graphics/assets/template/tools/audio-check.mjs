#!/usr/bin/env node
// The score, checked without ears. You cannot listen to the track, so measure it and look at it:
//  · loudness, true peak, loudness range (ffmpeg ebur128), clipping, DC offset;
//  · the short-term loudness of every scene window of js/timeline.mjs — does the energy follow the story?;
//  · spectral balance (sub / bass / low-mid / mid / presence / air) and stereo correlation (is the low end mono?);
//  · a picture of the whole track: spectrogram over waveform, a line at every cue, scene starts and bar lines —
//    out/qa/<name>-audio.png. Open it and read it: drops, holes before hits, risers, the tail;
//  · is it new? its fingerprint (tools/sound-print.mjs) against the template demo and the projects next to this one.
//   node tools/audio-check.mjs [out/music.wav] [--lufs -14] [--zoom 12-20] [--against other.wav …]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { curveOf, perScene, planVerdict } from './energy.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const TL = await import(pathToFileURL(path.join(ROOT, 'js/timeline.mjs')).href);
const ai = args.indexOf('--against');
const against = ai >= 0 ? args.slice(ai + 1).filter((a) => !a.startsWith('--')) : [];
const given = args.find((a, i) => !a.startsWith('--') && !['--lufs', '--zoom'].includes(args[i - 1]) && (ai < 0 || i < ai));
const file = given ? path.resolve(given) : path.join(ROOT, 'out/music.wav');
if (!fs.existsSync(file)) { console.error(`no ${file} — run node audio/score.mjs first`); process.exit(1); }
const target = Number(opt('lufs', -14));
const name = path.basename(file).replace(/\.\w+$/, '');
const rows = [];
const add = (level, what, detail) => rows.push({ level, what, detail });
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

// ---- loudness: summary + the short-term curve (every 100 ms) ------------------------------------------------------------
const lr = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true:framelog=info', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 27 });
const llog = lr.stderr || '';
const curve = curveOf(llog);
const sum = llog.slice(llog.lastIndexOf('Summary:'));
const I = Number(sum.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
const LRA = Number(sum.match(/LRA:\s+([\d.]+) LU/)?.[1]);
const TP = Number(sum.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/)?.[1]);
add(Math.abs(I - target) <= 1 ? 'PASS' : 'WARN', 'loudness', `${I} LUFS integrated (target ${target}), LRA ${LRA} LU`);
add(TP <= -1 ? 'PASS' : TP <= -0.3 ? 'WARN' : 'FAIL', 'true peak', `${TP} dBTP (≤ -1 leaves room for AAC)`);

// ---- samples ----------------------------------------------------------------------------------------------------------------
const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], { maxBuffer: 1 << 30 }).stdout;
const X = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength >> 2);
const N = X.length >> 1;
const SR = 48000;
const dur = N / SR;
let clips = 0; let dcL = 0; let dcR = 0; let sLL = 0; let sRR = 0; let sLR = 0; let peak = 0;
for (let i = 0; i < N; i++) {
  const l = X[2 * i]; const r = X[2 * i + 1];
  if (Math.abs(l) >= 0.9999 || Math.abs(r) >= 0.9999) clips++;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
  dcL += l; dcR += r; sLL += l * l; sRR += r * r; sLR += l * r;
}
dcL /= N; dcR /= N;
add(clips ? 'FAIL' : 'PASS', 'clipping', `${clips} samples at full scale, sample peak ${db(peak).toFixed(2)} dBFS`);
add(Math.max(Math.abs(dcL), Math.abs(dcR)) > 0.002 ? 'WARN' : 'PASS', 'dc offset', `${dcL.toExponential(1)} / ${dcR.toExponential(1)}`);
const corr = sLR / Math.sqrt(sLL * sRR || 1);
add(corr < 0.1 ? 'WARN' : 'PASS', 'stereo', `L/R correlation ${corr.toFixed(2)} (below 0.1 = phasey or too wide; 1 = mono)`);

// RBJ biquads for the band split
function biquad(type, f, q = 0.707) {
  const w = (2 * Math.PI * f) / SR; const cw = Math.cos(w); const al = Math.sin(w) / (2 * q);
  let b0; let b1; let b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; } else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
  const a0 = 1 + al; const a1 = -2 * cw; const a2 = 1 - al;
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  return (x) => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
const chain = (...fs) => (x) => fs.reduce((v, f) => f(v), x);
const BANDS = [
  ['sub', 20, 60], ['bass', 60, 250], ['low-mid', 250, 800], ['mid', 800, 3000], ['presence', 3000, 8000], ['air', 8000, 20000],
];
const filt = BANDS.map(([, lo, hi]) => chain(...(lo > 20 ? [biquad('hp', lo), biquad('hp', lo)] : []), ...(hi < 20000 ? [biquad('lp', hi), biquad('lp', hi)] : [])));
const energy = BANDS.map(() => 0);
let total = 0;
const subL = chain(biquad('lp', 120), biquad('lp', 120));
const subR = chain(biquad('lp', 120), biquad('lp', 120));
let bLL = 0; let bRR = 0; let bLR = 0;
for (let i = 0; i < N; i++) {
  const l = X[2 * i]; const r = X[2 * i + 1]; const m = (l + r) / 2;
  total += m * m;
  for (let k = 0; k < filt.length; k++) { const y = filt[k](m); energy[k] += y * y; }
  const sl = subL(l); const sr = subR(r);
  bLL += sl * sl; bRR += sr * sr; bLR += sl * sr;
}
const rel = energy.map((e) => 10 * Math.log10(e / total || 1e-12));
const bar = (d) => '#'.repeat(Math.max(0, Math.round((d + 40) / 2)));
console.log('spectral balance (energy relative to the whole mix):');
BANDS.forEach(([n, lo, hi], k) => console.log(`  ${n.padEnd(9)} ${String(lo).padStart(5)}–${String(hi).padEnd(5)} Hz ${rel[k].toFixed(1).padStart(6)} dB  ${bar(rel[k])}`));
const subCorr = bLR / Math.sqrt(bLL * bRR || 1);
add(subCorr < 0.85 ? 'WARN' : 'PASS', 'low end', `correlation below 120 Hz ${subCorr.toFixed(2)} (keep the sub mono: > 0.9)`);
const [rSub, rBass, rLowMid, , rPres, rAir] = rel;
if (10 * Math.log10(10 ** (rSub / 10) + 10 ** (rBass / 10)) < -10) add('WARN', 'balance', 'little energy below 250 Hz — no weight (kick / bass too quiet?)');
if (rLowMid > -5) add('WARN', 'balance', `low-mid ${rLowMid.toFixed(1)} dB — muddy: high-pass pads/FX at 150–300 Hz, thin the chords`);
if (rAir < -42) add('WARN', 'balance', `air ${rAir.toFixed(1)} dB — dull: hats, shimmer or brightness on the top`);
if (10 * Math.log10(10 ** (rPres / 10) + 10 ** (rAir / 10)) > -6) add('WARN', 'balance', 'too much above 3 kHz — harsh or thin');

// ---- the start and the end ------------------------------------------------------------------------------------------------
let first = 0;
while (first < N && Math.abs(X[2 * first]) < 0.003 && Math.abs(X[2 * first + 1]) < 0.003) first++;
add(first / SR > 0.5 ? 'WARN' : 'PASS', 'start', `first sound at ${(first / SR).toFixed(2)} s`);
let endE = 0;
const endN = Math.min(N, Math.round(0.05 * SR));
for (let i = N - endN; i < N; i++) endE += X[2 * i] ** 2 + X[2 * i + 1] ** 2;
const endDb = 10 * Math.log10(endE / (2 * endN) || 1e-12);
add(endDb > -40 ? 'WARN' : 'PASS', 'ending', `last 50 ms at ${endDb.toFixed(1)} dBFS RMS (an abrupt cut if above -40: let the tail ring out or fade)`);
add(Math.abs(dur - TL.DURATION) > 0.25 ? 'WARN' : 'PASS', 'length', `${dur.toFixed(2)} s (timeline ${TL.DURATION} s)`);

// ---- energy per scene --------------------------------------------------------------------------------------------------------
if (TL.S && curve.length) {
  // against the energy plan of js/timeline.mjs (ENERGY), when there is one (tools/energy.mjs)
  console.log(`short-term loudness per scene (LUFS, 3 s window) — the arc of the story${TL.ENERGY ? ', against the ENERGY plan' : ''}:`);
  const per = perScene(curve, TL.S);
  for (const q of per) console.log(`  ${q.name.padEnd(12)} ${q.a.toFixed(2).padStart(6)}–${q.z.toFixed(2).padEnd(6)} level ${Number.isFinite(q.level) ? q.level.toFixed(1).padStart(6) : '     –'}${q.long ? ' ' : '*'} ${(TL.ENERGY?.[q.name] || '').padEnd(4)}  ${bar((Number.isFinite(q.level) ? q.level : -70) + 14)}`);
  if (per.some((q) => !q.long)) console.log('  * a scene under 3.3 s, measured by momentary loudness (it can only WARN)');
  for (const r of planVerdict(per, TL.ENERGY ?? null)) add(r.level, r.what, r.detail);
}

// ---- the picture ---------------------------------------------------------------------------------------------------------------
const qaDir = path.join(ROOT, 'out', 'qa');
fs.mkdirSync(qaDir, { recursive: true });
const zoom = opt('zoom', null)?.split('-').map(Number);
const [z0, z1] = zoom || [0, dur];
const PW = 1600;
const xOf = (t) => Math.round(((t - z0) / (z1 - z0)) * PW);
const inView = (t) => t >= z0 && t <= z1;
const marks = [];
if (TL.BEAT) for (let t = 0, k = 0; t <= z1; t += TL.BEAT * 4, k++) if (inView(t)) marks.push(`drawbox=x=${xOf(t)}:y=0:w=1:h=ih:color=white@${k % 4 === 0 ? 0.35 : 0.13}:t=fill`);
for (const [, [a]] of Object.entries(TL.S || {})) if (inView(a)) marks.push(`drawbox=x=${xOf(a)}:y=0:w=3:h=ih:color=0x00e5ff@0.8:t=fill`);
const cues = Object.entries(TL.CUE || {}).filter(([, t]) => typeof t === 'number' && inView(t));
for (const [, t] of cues) marks.push(`drawbox=x=${xOf(t)}:y=0:w=2:h=26:color=0xffd400@0.95:t=fill`, `drawbox=x=${xOf(t)}:y=0:w=1:h=ih:color=0xffd400@0.45:t=fill`);
const pic = path.join(qaDir, `${name}-audio${zoom ? `-${z0}-${z1}` : ''}.png`);
const pre = zoom ? `atrim=start=${z0}:end=${z1},asetpts=N/SR/TB,` : '';
const graph = `[0:a]${pre}asplit=2[a1][a2];[a1]showspectrumpic=s=${PW}x440:legend=0:fscale=log:color=intensity[sp];`
  + `[a2]aformat=channel_layouts=mono,showwavespic=s=${PW}x160:colors=0xcfcfcf[wv];[sp][wv]vstack=inputs=2${marks.length ? `,${marks.join(',')}` : ''}[o]`;
const pr = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-filter_complex', graph, '-map', '[o]', '-frames:v', '1', pic], { encoding: 'utf8' });
if (pr.status === 0) {
  add('INFO', 'picture', `${path.relative(ROOT, pic)} — spectrogram (log frequency) over waveform, ${z0.toFixed(1)}–${z1.toFixed(1)} s`);
  console.log(`legend: cyan = scene starts, yellow = cues (tick on top), white = bar lines (brighter every 4 bars); ${((z1 - z0) / PW * 1000).toFixed(1)} ms per pixel`);
  console.log(`cues in view: ${cues.map(([n, t]) => `${n}@${t.toFixed(2)}`).join('  ')}`);
} else add('WARN', 'picture', `ffmpeg could not draw it: ${pr.stderr.trim().split('\n').pop()}`);

// ---- is it new? ------------------------------------------------------------------------------------------------------------------
const SP = await import(pathToFileURL(path.join(HERE, 'sound-print.mjs')).href);
const me = SP.printOf(file, { bpm: file.startsWith(path.join(ROOT, 'out')) ? TL.BPM : null });
fs.writeFileSync(path.join(qaDir, `${name}-print.json`), JSON.stringify(me, null, 1));
const u = SP.verdict(me, ROOT, against);
console.log(`fingerprint: ${me.bpm} BPM, key ≈ ${me.key}, ${SP.grooveName(me)}; nearest (1 = the same track):`);
for (const { o, c } of u.near.slice(0, 5)) {
  const tr = c.traits; // what the score is made of: groove 35 %, timbre (kit, voices) 35 %, tempo 30 %; key and chords are shown only
  console.log(`  ${c.score.toFixed(2)}  ${o.label} (${o.bpm} BPM, ${o.key}) — groove ${tr.groove.toFixed(2)}, timbre ${tr.timbre.toFixed(2)}, tempo ${tr.tempo.toFixed(2)}${c.same.length ? `; same ${c.same.join(', ')}` : ''}`);
}
add(u.level, 'unique', u.detail);

console.log(`AUDIO ${path.relative(ROOT, file)}  ${dur.toFixed(2)} s`);
for (const r of rows) console.log(`${r.level.padEnd(5)} ${r.what.padEnd(10)} ${r.detail}`);
const fails = rows.filter((r) => r.level === 'FAIL').length;
console.log(fails ? `${fails} FAIL` : 'no failures');
if (fails) process.exitCode = 1;
