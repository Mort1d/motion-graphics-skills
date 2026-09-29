#!/usr/bin/env node
// Recorded sounds for the score (audio/synth/sample.mjs): converts each file — wav, mp3, ogg, m4a, flac — to a 48 kHz
// stereo WAV in audio/kit/ and measures where it is loudest, since a sample is placed with that moment on its cue.
//   node tools/kit.mjs <files or folders…> [--out audio/kit]
// Writes audio/kit/KIT.md: a row per sound (length, loudest at, peak level) with a column for its source and licence —
// fill it in. Only sounds the person recorded, owns, or downloaded themselves under a licence that allows commercial
// use; a "free" track can still draw a Content ID claim. Never bulk-download a library with a script.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = path.resolve(oi >= 0 ? args[oi + 1] : path.join(ROOT, 'audio/kit'));
const inputs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
if (!inputs.length) { console.log('usage: node tools/kit.mjs <audio files or folders…> [--out audio/kit]'); process.exit(1); }
const { readWav, peakOf } = await import(pathToFileURL(path.join(ROOT, 'audio/synth/sample.mjs')).href);

const AUDIO = /\.(wav|mp3|ogg|oga|opus|m4a|aac|flac|aif|aiff|wma|webm)$/i;
const files = [];
for (const a of inputs) {
  const p = path.resolve(a);
  if (!fs.existsSync(p)) { console.log(`  ! not found: ${a}`); continue; }
  if (fs.statSync(p).isDirectory()) for (const n of fs.readdirSync(p).sort()) { if (AUDIO.test(n)) files.push(path.join(p, n)); } else files.push(p);
}
fs.mkdirSync(OUT, { recursive: true });
const rows = [];
const used = new Set();
for (const f of files) {
  const base = path.basename(f).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9а-яё_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'sound';
  let name = base;
  for (let k = 2; used.has(name); k++) name = `${base}-${k}`;
  used.add(name);
  const out = path.join(OUT, `${name}.wav`);
  if (path.resolve(f) !== out) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_f32le', out], { encoding: 'utf8' });
    if (r.status !== 0) { console.log(`  ! ${path.basename(f)}: ffmpeg could not read it (${(r.stderr || '').trim().split('\n').pop()})`); continue; }
  }
  const w = readWav(out);
  const len = w.L.length / w.rate;
  let peak = 0;
  for (let i = 0; i < w.L.length; i++) peak = Math.max(peak, Math.abs(w.L[i]), Math.abs(w.R[i]));
  const at = peakOf(w);
  const notes = [];
  if (len > 20) notes.push('a whole track? use it as the soundtrack (sound-design.md §4), not a sample');
  if (at > 0.25 && len <= 20) notes.push(`plays ${at.toFixed(2)} s before its cue`);
  if (peak < 0.05) notes.push('very quiet');
  rows.push({ file: path.basename(out), from: path.basename(f), len, at, db: peak > 0 ? 20 * Math.log10(peak) : -Infinity, notes });
  console.log(`  ${path.basename(out).padEnd(28)} ${len.toFixed(2).padStart(6)} s   loudest at ${(at * 1000).toFixed(0).padStart(5)} ms   peak ${(peak > 0 ? 20 * Math.log10(peak) : -99).toFixed(1)} dBFS${notes.length ? `   (${notes.join('; ')})` : ''}`);
}
const md = ['# Sound kit', '', 'Recorded sounds for the score: `sample(t, \'audio/kit/<file>\', { vel, pan, verb })` puts each one\'s loudest moment on t.',
  'Fill in where each file comes from and its licence. Only sounds the person recorded, owns, or downloaded themselves under a licence that allows commercial use.', '',
  '| File | From | Length | Loudest at | Peak | Source and licence |', '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.file} | ${r.from} | ${r.len.toFixed(2)} s | ${(r.at * 1000).toFixed(0)} ms | ${r.db.toFixed(1)} dBFS | |`), ''];
const kitMd = path.join(OUT, 'KIT.md');
if (fs.existsSync(kitMd)) {
  // keep what was written in the licence column, and the rows of sounds added by earlier runs
  const old = fs.readFileSync(kitMd, 'utf8').split('\n');
  for (let i = 0; i < md.length; i++) {
    const m = /^\| ([^|]+) \|/.exec(md[i]);
    const prev = m && old.find((l) => l.startsWith(`| ${m[1]} |`));
    if (prev) md[i] = md[i].replace(/\| \|$/, `|${prev.split('|').slice(-2, -1)[0]}|`);
  }
  const now = new Set(rows.map((r) => r.file));
  const earlier = old.filter((l) => { const m = /^\| ([^|]+\.wav) \|/.exec(l); return m && !now.has(m[1]) && fs.existsSync(path.join(OUT, m[1])); });
  md.splice(md.length - 1, 0, ...earlier);
}
fs.writeFileSync(kitMd, md.join('\n'));
console.log(`${rows.length} sound(s) → ${path.relative(ROOT, OUT) || OUT}; fill in their sources and licences in ${path.relative(ROOT, kitMd)}`);
