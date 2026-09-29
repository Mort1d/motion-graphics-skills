#!/usr/bin/env node
// Delivery check of a rendered video, in one decoding pass: codec / size / fps / duration against js/timeline.mjs,
// loudness and true peak, black or frozen stretches, silence, flat frames, single-frame pops, the loop seam (LOOP),
// leftover template demo code; plus a contact sheet of the encoded file to look at (out/qa/<name>-sheet.png).
//   node tools/qa.mjs [out/<name>.mp4] [--lufs -14] [--draft]
// Exit code 1 when something FAILs; WARN lines are worth a look but may be intentional (a held end card, a dark scene).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { curveOf, perScene, planVerdict } from './energy.mjs';
import { findPops } from './pops.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const TL = await import(pathToFileURL(path.join(ROOT, 'js/timeline.mjs')).href);

let file = args.find((a, i) => !a.startsWith('--') && !['--lufs'].includes(args[i - 1]));
if (!file) {
  const dir = path.join(ROOT, 'out');
  const mp4s = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.mp4') && !/-(web|draft)\.mp4$/.test(f)) : [];
  mp4s.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
  if (!mp4s.length) { console.error('usage: node tools/qa.mjs out/<name>.mp4'); process.exit(1); }
  file = path.join(dir, mp4s[0]);
}
file = path.resolve(file);
const name = path.basename(file, '.mp4');
// a draft is rendered at half size: named so by render.mjs, or said with --draft
const draft = args.includes('--draft') || /-draft$/.test(name);
const target = Number(opt('lufs', -14));
const rows = [];
const add = (level, what, detail) => rows.push({ level, what, detail });

// ---- container ----------------------------------------------------------------------------------------------------
const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { encoding: 'utf8' }).stdout || '{}');
if (!probe.format) { console.error(`cannot read ${file}`); process.exit(1); }
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
const dur = Number(probe.format.duration);
const fps = v ? v.r_frame_rate.split('/').map(Number).reduce((x, y) => x / y) : 0; // "60/1"
const wantW = draft ? Math.round(TL.W / 2) : TL.W;
const wantH = draft ? Math.round(TL.H / 2) : TL.H;
add(v?.codec_name === 'h264' && v.pix_fmt === 'yuv420p' ? 'PASS' : 'FAIL', 'video', `${v?.codec_name} ${v?.pix_fmt} ${v?.profile ?? ''}`);
add(Math.abs(v.width - wantW) <= 1 && Math.abs(v.height - wantH) <= 1 ? 'PASS' : 'FAIL', 'size', `${v.width}x${v.height} (timeline ${wantW}x${wantH})`);
add(Math.abs(fps - TL.FPS) < 0.01 ? 'PASS' : 'FAIL', 'fps', `${fps} (timeline ${TL.FPS})`);
// a cutdown (tools/cutdown.mjs: -cut, -15s …) is shorter than the timeline on purpose
const isCut = args.includes('--cut') || /-(cut|\d+s)(-\w+)?\.mp4$/i.test(file);
add(Math.abs(dur - TL.DURATION) <= 0.1 ? 'PASS' : isCut ? 'INFO' : 'WARN', 'duration', `${dur.toFixed(2)} s (timeline ${TL.DURATION} s${isCut ? ', a cutdown' : ''})`);
if (!a) add('WARN', 'audio', 'no audio stream — render after `node audio/score.mjs`');
else add(a.codec_name === 'aac' && Number(a.sample_rate) === 48000 && a.channels === 2 ? 'PASS' : 'WARN', 'audio', `${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch ${Math.round((a.bit_rate || 0) / 1000)} kb/s`);
add('INFO', 'file', `${(probe.format.size / 1048576).toFixed(1)} MB, ${Math.round(probe.format.bit_rate / 1000)} kb/s`);

// ---- one decoding pass: black, frozen, loudness, silence ------------------------------------------------------------
const fc = [`[0:v]blackdetect=d=0.5:pix_th=0.08,freezedetect=n=-60dB:d=2[vo]`];
if (a) fc.push(`[0:a]ebur128=peak=true:framelog=info,silencedetect=n=-50dB:d=1.5[ao]`);
const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-filter_complex', fc.join(';'), '-map', '[vo]', ...(a ? ['-map', '[ao]'] : []), '-f', 'null', '-'],
  { encoding: 'utf8', maxBuffer: 1 << 26 });
const log = r.stderr || '';
const tail = Math.min(4, dur * 0.2); // the end card may hold still and fade
for (const m of log.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)) {
  const [s, e] = [Number(m[1]), Number(m[2])];
  add(s < 0.05 || e > dur - 0.3 ? 'INFO' : 'WARN', 'black', `${s.toFixed(2)}–${e.toFixed(2)} s is (almost) black`);
}
const fs0 = [...log.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1]));
const fe0 = [...log.matchAll(/freeze_end: ([\d.]+)/g)].map((m) => Number(m[1]));
fs0.forEach((s, i) => {
  const e = fe0[i] ?? dur;
  add(s > dur - tail - 2 ? 'INFO' : 'WARN', 'frozen', `${s.toFixed(2)}–${e.toFixed(2)} s: no pixel changes for ${(e - s).toFixed(1)} s`);
});
if (a) {
  const sum = log.slice(log.lastIndexOf('Summary:'));
  const I = Number(sum.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
  const LRA = Number(sum.match(/LRA:\s+([\d.]+) LU/)?.[1]);
  const TP = Number(sum.match(/True peak:\s+Peak:\s+(-?[\d.inf]+) dBFS/)?.[1]);
  add(I >= target - 2.5 && I <= target + 2 ? 'PASS' : 'WARN', 'loudness', `${I} LUFS integrated (target ${target}), LRA ${LRA} LU`);
  add(TP <= -0.5 ? 'PASS' : TP <= 0 ? 'WARN' : 'FAIL', 'true peak', `${TP} dBTP (keep ≤ -1 in the WAV; AAC adds a little)`);
  for (const m of log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)) {
    const [s, e] = [Number(m[1]), Number(m[2])];
    add(s > dur - 2 ? 'INFO' : 'WARN', 'silence', `${s.toFixed(2)}–${e.toFixed(2)} s below -50 dB`);
  }
  // the energy plan of js/timeline.mjs, on the delivered sound (a cutdown has its own order of scenes: skipped)
  if (!isCut && TL.S) for (const r of planVerdict(perScene(curveOf(log), TL.S), TL.ENERGY ?? null)) if (r.what === 'energy' || TL.ENERGY) add(r.level, r.what, r.detail);
}

// ---- dead frames: a few flat frames between scenes (a wipe ends, the next slam has not started) ----------------------------
// every frame at 96 px wide: the share of pixels that differ from the frame's dominant colour. A run of ≥ 2 frames with
// almost nothing on them, away from the first and the last second, is nearly always a gap in the scene windows.
{
  const sw = 96; const shh = Math.max(2, Math.round((sw * v.height) / v.width / 2) * 2);
  const px = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${sw}:${shh}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 }).stdout;
  const n = sw * shh; const frames = Math.floor(px.length / (n * 3));
  const flat = []; let lumSum = 0;
  for (let f = 0; f < frames; f++) {
    const o = f * n * 3; const hist = new Map();
    for (let i = 0; i < n; i++) { const k = ((px[o + 3 * i] >> 4) << 8) | ((px[o + 3 * i + 1] >> 4) << 4) | (px[o + 3 * i + 2] >> 4); hist.set(k, (hist.get(k) || 0) + 1); }
    let bk = 0; let bn = -1; for (const [k, c] of hist) if (c > bn) { bn = c; bk = k; }
    const bg = [((bk >> 8) & 15) * 16 + 8, ((bk >> 4) & 15) * 16 + 8, (bk & 15) * 16 + 8];
    let on = 0;
    for (let i = 0; i < n; i++) {
      const r = px[o + 3 * i]; const g = px[o + 3 * i + 1]; const b = px[o + 3 * i + 2];
      if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 60) on++;
      lumSum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    flat.push(on / n < 0.004);
  }
  const runs = [];
  for (let f = 0; f < frames;) {
    if (!flat[f]) { f++; continue; }
    let e = f; while (e < frames && flat[e]) e++;
    const a = f / fps; const z = e / fps;
    if (e - f >= 2 && a > 1 && z < dur - 1) runs.push([a, z]);
    f = e;
  }
  if (runs.length) {
    const [a0, z0] = runs[0];
    add('WARN', 'flash', `flat frames at ${runs.slice(0, 6).map(([a, z]) => `${a.toFixed(2)}–${z.toFixed(2)} s`).join(', ')}${runs.length > 6 ? ' …' : ''} — a gap between scenes `
      + `unless it is a deliberate hold; see it frame by frame: node tools/capture.mjs sheet ${(a0 - 0.1).toFixed(2)} ${(z0 + 0.1).toFixed(2)} 12`);
  }
  const lum = lumSum / (frames * n || 1);
  add('INFO', 'look', `${lum < 0.3 ? 'dark' : lum > 0.6 ? 'light' : 'mid-tone'} (mean luminance ${lum.toFixed(2)}) — is that the brand's own look?`);

  // single-frame pops (tools/pops.mjs) and, for a video that loops, the seam: the same thumbnails in grey
  const grey = Buffer.alloc(frames * n);
  for (let i = 0; i < frames * n; i++) grey[i] = Math.round(0.299 * px[3 * i] + 0.587 * px[3 * i + 1] + 0.114 * px[3 * i + 2]);
  const thumbs = { frames: grey, w: sw, h: shh, n: frames };
  // the hook moves: the longest still stretch of the first 1.5 s (a slam, a hold, a slam is fine; a logo on black is not)
  const first = Math.min(frames - 1, Math.round(1.5 * fps));
  let still = 0;
  let run = 0;
  let runAt = 0;
  for (let k = 1; k <= first; k++) {
    let d = 0;
    for (let i = 0; i < n; i++) d += Math.abs(grey[k * n + i] - grey[(k - 1) * n + i]);
    run = d / n > 0.1 ? 0 : run + 1;
    if (run > still) { still = run; runAt = (k - run) / fps; }
  }
  add(still / fps <= 0.5 ? 'PASS' : 'WARN', 'hook', still / fps <= 0.5
    ? `the opening moves (the longest still stretch of the first 1.5 s is ${(still / fps).toFixed(2)} s)`
    : `nothing moves for ${(still / fps).toFixed(2)} s from ${runAt.toFixed(2)} s — the feed scrolls on: motion from frame 1, the words within the first second`);
  const pops = findPops(thumbs, { fps });
  if (pops.length) {
    const p0 = pops[0].t;
    add('WARN', 'pops', `a frame unlike both of its neighbours at ${pops.slice(0, 6).map((p) => `${p.t.toFixed(3)} s`).join(', ')}${pops.length > 6 ? ' …' : ''} — `
      + `a scene drawn a frame early, a number or a title that blinks; fine only if it is a designed one-frame glitch: node tools/capture.mjs sheet ${Math.max(0, p0 - 0.05).toFixed(3)} ${(p0 + 0.05).toFixed(3)} 7`);
  } else add('PASS', 'pops', 'no single-frame pops');
  if (TL.LOOP && !isCut && frames > 1) {
    let d = 0;
    for (let i = 0; i < n; i++) d += Math.abs(grey[i] - grey[(frames - 1) * n + i]);
    d /= n;
    add(d <= 2 ? 'PASS' : 'FAIL', 'loop', `first and last frame differ by ${d.toFixed(1)} of 255 — ${d <= 2 ? 'the loop is seamless' : 'a loop ends on its own first frame (LOOP in js/timeline.mjs)'}`);
  }
}

// ---- leftovers of the template: only in files the video actually uses ----------------------------------------------------
// the scenes named in SCENES (js/reel.js) and everything imported from them, main.js and the score
const used = new Set();
const reelSrc = fs.existsSync(path.join(ROOT, 'js/reel.js')) ? fs.readFileSync(path.join(ROOT, 'js/reel.js'), 'utf8') : '';
const sceneNames = (reelSrc.match(/export const SCENES\s*=\s*\[([^\]]*)\]/)?.[1] || '').match(/['"][\w-]+['"]/g) || [];
const queue = ['js/main.js', 'js/reel.js', 'audio/score.mjs', ...sceneNames.map((q) => `js/scenes/${q.slice(1, -1)}.js`)]
  .map((f) => path.join(ROOT, f));
while (queue.length) {
  const f = queue.shift();
  if (used.has(f) || !fs.existsSync(f)) continue;
  used.add(f);
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:from\s*|import\(\s*)['"](\.{1,2}\/[^'"`$]+)['"]/g)) queue.push(path.resolve(path.dirname(f), m[1]));
}
const hasDemo = (f) => fs.readFileSync(f, 'utf8').includes('@template-demo');
const leftovers = [...used].filter(hasDemo).map((f) => path.relative(ROOT, f));
for (const f of ['index.html', ...(fs.existsSync(path.join(ROOT, 'css')) ? fs.readdirSync(path.join(ROOT, 'css')).map((n) => `css/${n}`) : [])]) {
  if (fs.existsSync(path.join(ROOT, f)) && hasDemo(path.join(ROOT, f))) leftovers.push(path.normalize(f));
}
if (leftovers.length) add('WARN', 'template', `demo code still in: ${leftovers.join(', ')} — every video needs its own scenes and its own score`);
const scenesDir = path.join(ROOT, 'js', 'scenes');
const unused = fs.existsSync(scenesDir) ? fs.readdirSync(scenesDir).map((n) => path.join(scenesDir, n)).filter((f) => !used.has(f) && hasDemo(f)) : [];
if (unused.length) add('INFO', 'template', `unused demo scenes: ${unused.map((f) => path.relative(ROOT, f)).join(', ')} — delete them`);

// ---- the video never numbers itself: js/main.js lints the built scenes into window.__lint ------------------------------
const lint = spawnSync(process.execPath, [path.join(HERE, 'capture.mjs'), 'eval', 'window.__lint || []', '--quiet'], { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
let found = null;
try { found = JSON.parse((lint.stdout || '').slice((lint.stdout || '').indexOf('['))); } catch { found = null; }
if (!Array.isArray(found)) add('INFO', 'counters', 'could not read the page lint (tools/capture.mjs eval) — look for a scene counter by eye');
else {
  const counters = found.filter((l) => (l.kind ?? 'counter') === 'counter');
  const cut = found.filter((l) => l.kind === 'overflow');
  if (counters.length) add('FAIL', 'counters', `${counters.map((l) => `"${l.text}" at ${l.t} s`).join(', ')} — a scene counter reads as a template: the video never numbers its own scenes`);
  else add('PASS', 'counters', 'no scene counter or chapter label on screen');
  if (cut.length) add('WARN', 'edges', `${cut.slice(0, 6).map((l) => `"${l.text}" ${l.px} px out at ${l.t} s`).join(', ')}${cut.length > 6 ? ' …' : ''} — text cut by the edge of the frame: fitFont() it or move it inside (a still at that time shows it)`);
  else add('PASS', 'edges', 'no text cut by the edge of the frame at the settled moments of the scenes');
}

// ---- is the soundtrack new? the demo score and the promos next to this project (tools/sound-print.mjs) -------------------
if (a) {
  try {
    const SP = await import(pathToFileURL(path.join(HERE, 'sound-print.mjs')).href);
    const u = SP.verdict(SP.printOf(file, { bpm: TL.BPM }), ROOT);
    add(u.level, 'unique', u.detail);
  } catch (e) { add('WARN', 'unique', `could not fingerprint the soundtrack: ${e.message}`); }
}

// ---- contact sheet of the encoded file -------------------------------------------------------------------------------
const qaDir = path.join(ROOT, 'out', 'qa');
fs.mkdirSync(qaDir, { recursive: true });
const n = 24;
const sheet = path.join(qaDir, `${name}-sheet.png`);
const tw = TL.W >= TL.H ? 320 : 200;
spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `fps=${n}/${dur.toFixed(3)},scale=${tw}:-2,tile=6x${Math.ceil(n / 6)}:padding=4:color=0x202020`, '-frames:v', '1', sheet]);
if (fs.existsSync(sheet)) add('INFO', 'sheet', `${path.relative(ROOT, sheet)} — look at it`);

// ---- report -----------------------------------------------------------------------------------------------------------
console.log(`QA ${path.relative(ROOT, file)}`);
for (const row of rows) console.log(`${row.level.padEnd(5)} ${row.what.padEnd(10)} ${row.detail}`);
const fails = rows.filter((x) => x.level === 'FAIL').length;
const warns = rows.filter((x) => x.level === 'WARN').length;
console.log(fails ? `${fails} FAIL, ${warns} WARN` : `no failures${warns ? `, ${warns} WARN to review` : ''}`);
if (fails) process.exitCode = 1;
