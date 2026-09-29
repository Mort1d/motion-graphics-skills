#!/usr/bin/env node
// The person's own footage — travel clips, an event, a product filmed on a phone, a screen recording — made ready for
// the edit. Nothing is uploaded and the originals are never changed.
//   node tools/footage.mjs scan <files or folders…>
//        what is in each clip: its shots, how much moves, which way the camera goes, the light, where on a still shot
//        the picture changes → assets/footage/scan.json and a sheet per clip (a frame every second or two, the time
//        in its corner). Photos in the folders are listed with their size.
//   node tools/footage.mjs cut <clip> <from>-<to> [--name n] [--focus x,y] [--scale 1] [--fps n] [--sound]
//        the frames of that stretch at the video's size, cover-cropped around the focus (0..1, default the middle),
//        → assets/footage/<name>/00000.jpg … and its entry in js/footage.data.mjs (js/footage.mjs reads it).
//        --scale 1.5 for a shot the camera will push into; --sound also writes its sound to audio/kit/<name>.wav.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'assets/footage');
const DATA = path.join(ROOT, 'js/footage.data.mjs');
const argv = process.argv.slice(2);
const mode = argv[0];
const flags = {};
const pos = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { pos.push(a); continue; }
  const k = a.slice(2);
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) flags[k] = true; else { flags[k] = v; i++; }
}
const VIDEO = /\.(mp4|mov|m4v|mkv|webm|avi|mts|m2ts|3gp)$/i;
const IMAGE = /\.(jpe?g|png|webp|heic|heif|avif|tiff?)$/i;
const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9а-яё_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'clip';
const even = (x) => 2 * Math.round(x / 2);
const r1 = (x) => Math.round(x * 10) / 10;

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe cannot read ${file}: ${(r.stderr || '').trim().split('\n').pop()}`);
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  if (!v) throw new Error(`${file} has no picture`);
  // phones film upright and store it as a rotation: the decoded frames are turned, so are the sizes here
  const rot = Number(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0);
  let [w, h] = [v.width, v.height];
  if (Math.abs(rot) % 180 === 90) [w, h] = [h, w];
  const rate = (x) => { const [a, b] = String(x || '0/1').split('/').map(Number); return b ? a / b : a || 0; };
  const fps = rate(v.avg_frame_rate) || rate(v.r_frame_rate) || 30;
  return { w, h, fps, dur: Number(j.format?.duration) || Number(v.duration) || 0, sound: (j.streams || []).some((s) => s.codec_type === 'audio') };
}

// ---- scan ------------------------------------------------------------------------------------------------------------
const T = 10; // analysis frames per second

/** Mean absolute difference of B(x, y) against A(x − dx, y − dy) over their overlap. */
function sad(A, B, w, h, dx, dy) {
  let s = 0;
  let n = 0;
  const x0 = Math.max(0, dx); const x1 = Math.min(w, w + dx);
  const y0 = Math.max(0, dy); const y1 = Math.min(h, h + dy);
  for (let y = y0; y < y1; y++) {
    const rb = y * w;
    const ra = (y - dy) * w - dx;
    for (let x = x0; x < x1; x++) { s += Math.abs(B[rb + x] - A[ra + x]); n++; }
  }
  return n ? s / n : Infinity;
}
const half = (F, w, h) => {
  const w2 = w >> 1; const h2 = h >> 1;
  const o = new Float32Array(w2 * h2);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    const i = 2 * y * w + 2 * x;
    o[y * w2 + x] = (F[i] + F[i + 1] + F[i + w] + F[i + w + 1]) / 4;
  }
  return o;
};
/** How the picture moved from A to B: [dx, dy] in thumbnail px and what the move leaves unexplained (a cut is large). */
function shift(A, B, w, h) {
  const A2 = half(A, w, h); const B2 = half(B, w, h);
  const w2 = w >> 1; const h2 = h >> 1;
  let best = [0, 0, Infinity];
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const e = sad(A2, B2, w2, h2, dx, dy); if (e < best[2]) best = [dx, dy, e]; }
  let fine = [0, 0, Infinity];
  for (let dy = 2 * best[1] - 1; dy <= 2 * best[1] + 1; dy++) for (let dx = 2 * best[0] - 1; dx <= 2 * best[0] + 1; dx++) {
    const e = sad(A, B, w, h, dx, dy);
    if (e < fine[2]) fine = [dx, dy, e];
  }
  return fine;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

function analyse(file, info) {
  const tw = 96;
  const th = Math.max(2, even((tw * info.h) / info.w));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `fps=${T},scale=${tw}:${th}:flags=area,format=gray`, '-f', 'rawvideo', 'pipe:1'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg cannot decode ${file}: ${String(r.stderr || '').trim().split('\n').pop()}`);
  const px = tw * th;
  const n = Math.floor(r.stdout.length / px);
  const F = (i) => r.stdout.subarray(i * px, (i + 1) * px);
  const diff = new Float32Array(n);
  const rest = new Float32Array(n);
  const dx = new Float32Array(n);
  const dy = new Float32Array(n);
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const B = F(i);
    let l = 0;
    for (let k = 0; k < px; k++) l += B[k];
    luma[i] = l / px;
    if (!i) continue;
    const A = F(i - 1);
    diff[i] = sad(A, B, tw, th, 0, 0);
    const [x, y, e] = shift(A, B, tw, th);
    dx[i] = x; dy[i] = y; rest[i] = e;
  }
  // a cut: what no camera move explains, far above its neighbourhood (a whip pan explains itself, a cut does not)
  const cuts = [0];
  for (let i = 1; i < n; i++) {
    const around = [];
    for (let k = Math.max(1, i - 10); k < Math.min(n, i + 11); k++) if (k !== i) around.push(rest[k]);
    if (rest[i] > Math.max(18, 3 * median(around)) && i - cuts[cuts.length - 1] >= 5) cuts.push(i);
  }
  cuts.push(n);
  const shots = [];
  for (let c = 0; c + 1 < cuts.length; c++) {
    const a = cuts[c]; const z = cuts[c + 1];
    const ks = []; for (let k = a + 1; k < z; k++) ks.push(k);
    const mean = (arr) => (ks.length ? ks.reduce((s, k) => s + arr[k], 0) / ks.length : 0);
    const mx = mean(dx); const my = mean(dy);
    const speed = (Math.hypot(mx, my) / tw) * T * 100; // % of the frame width a second
    const horiz = Math.abs(mx) >= Math.abs(my);
    // the picture moving left = the camera panning right
    const camera = speed < 3 ? 'still' : horiz ? (mx < 0 ? 'pans right' : 'pans left') : (my < 0 ? 'tilts down' : 'tilts up');
    const moves = speed < 3 ? '' : horiz ? (mx < 0 ? 'left' : 'right') : (my < 0 ? 'up' : 'down');
    const lum = ks.length ? mean(luma) : luma[a];
    // the liveliest and the calmest second
    let peak = [a / T, Math.min(z, a + T) / T]; let calm = peak; let hi = -1; let lo = Infinity;
    for (let s = a + 1; s + T <= z; s += 2) {
      let m = 0; for (let k = s; k < s + T; k++) m += diff[k];
      if (m > hi) { hi = m; peak = [s / T, (s + T) / T]; }
      if (m < lo) { lo = m; calm = [s / T, (s + T) / T]; }
    }
    const shot = { from: r1(a / T), to: r1(z / T), motion: r1(mean(diff)), camera, speed: Math.round(speed), moves, light: lum < 50 ? 'dark' : lum > 205 ? 'bright' : 'ok', peak: peak.map(r1), calm: calm.map(r1) };
    // a still shot (a screen recording, a tripod): where the picture changes, second by second — the camera's targets
    if (camera === 'still') {
      const act = [];
      for (let s = a + 1; s < z; s += T) {
        let x0 = tw; let y0 = th; let x1 = -1; let y1 = -1; let hit = 0;
        for (let k = s; k < Math.min(z, s + T); k++) {
          const A = F(k - 1); const B = F(k);
          for (let p = 0; p < px; p++) if (Math.abs(B[p] - A[p]) > 12) { const x = p % tw; const y = (p / tw) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); hit++; }
        }
        const area = x1 < 0 ? 0 : ((x1 - x0 + 1) * (y1 - y0 + 1)) / px;
        if (hit >= 3 && area < 0.5) act.push({ t: r1(s / T), box: [x0 / tw, y0 / th, (x1 + 1) / tw, (y1 + 1) / th].map((v) => Math.round(v * 100) / 100) });
      }
      if (act.length) shot.activity = act;
    }
    shots.push(shot);
  }
  return shots;
}

function sheet(file, info, name) {
  const every = info.dur <= 36 ? 1 : Math.ceil(info.dur / 36);
  const count = Math.max(1, Math.ceil(info.dur / every - 1e-6)); // frames at 0, every, … before the end
  const cols = 6;
  const tw = info.w >= info.h ? 320 : 200;
  const out = path.join(OUT, `${name}-sheet.png`);
  const tile = `tile=${cols}x${Math.ceil(count / cols)}:padding=4:color=0x202020`;
  // the second of each frame in its corner (a font from the template; without one, the grid alone)
  const label = "drawtext=fontfile=assets/fonts/JetBrainsMono-Bold.ttf:text='%{eif\\:t\\:d} s':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=5";
  const run = (vf) => spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', vf, '-frames:v', '1', out], { cwd: ROOT, encoding: 'utf8' });
  let r = run(`fps=1/${every},scale=${tw}:-2,${label},${tile}`);
  let labelled = true;
  if (r.status !== 0) { r = run(`fps=1/${every},scale=${tw}:-2,${tile}`); labelled = false; }
  return r.status === 0 ? { sheet: path.relative(ROOT, out).replace(/\\/g, '/'), every, labelled, cols } : null;
}

function scan() {
  if (!pos.length) { console.log('usage: node tools/footage.mjs scan <video files or folders…>'); process.exit(1); }
  const files = [];
  for (const a of pos) {
    const p = path.resolve(a);
    if (!fs.existsSync(p)) { console.log(`  ! not found: ${a}`); continue; }
    if (fs.statSync(p).isDirectory()) for (const n of fs.readdirSync(p).sort()) { if (VIDEO.test(n) || IMAGE.test(n)) files.push(path.join(p, n)); } else files.push(p);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const clips = [];
  const stills = [];
  const used = new Set();
  for (const f of files) {
    let name = slug(path.basename(f));
    for (let k = 2; used.has(name); k++) name = `${slug(path.basename(f))}-${k}`;
    used.add(name);
    try {
      const info = probe(f);
      if (IMAGE.test(f) || info.dur < 0.2) { stills.push({ name, file: f, w: info.w, h: info.h }); continue; }
      const shots = analyse(f, info);
      const sh = sheet(f, info, name);
      clips.push({ name, file: f, dur: r1(info.dur), fps: Math.round(info.fps * 100) / 100, w: info.w, h: info.h, sound: info.sound, ...(sh || {}), shots });
      console.log(`\n${name}  ${info.dur.toFixed(1)} s  ${info.w}×${info.h}  ${Math.round(info.fps)} fps${info.sound ? '  sound' : ''}${sh ? `  sheet ${sh.sheet} (a frame every ${sh.every} s${sh.labelled ? ', the second in its corner' : `, ${sh.cols} across`})` : ''}`);
      for (const s of shots) {
        const move = s.camera === 'still' ? 'still' : `camera ${s.camera} ${s.speed} %/s (the picture moves ${s.moves})`;
        const act = s.activity ? `  changes at ${s.activity.slice(0, 3).map((a) => `${a.t} s [${a.box.join(', ')}]`).join(', ')}${s.activity.length > 3 ? ' …' : ''}` : '';
        console.log(`  ${`${s.from}–${s.to} s`.padEnd(13)} ${move.padEnd(46)} motion ${String(s.motion).padStart(4)}  light ${s.light.padEnd(6)}  liveliest ${s.peak[0]}–${s.peak[1]} s, calmest ${s.calm[0]}–${s.calm[1]} s${act}`);
      }
    } catch (e) { console.log(`  ! ${path.basename(f)}: ${e.message}`); }
  }
  if (stills.length) console.log(`\nphotos: ${stills.map((s) => `${s.name} ${s.w}×${s.h}`).join(', ')}`);
  fs.writeFileSync(path.join(OUT, 'scan.json'), JSON.stringify({ clips, stills }, null, 1));
  console.log(`\n${clips.length} clip(s), ${stills.length} photo(s) → assets/footage/scan.json. Look at the sheets, pick the moments, then: node tools/footage.mjs cut <clip> <from>-<to> --name <name>`);
}

// ---- cut -------------------------------------------------------------------------------------------------------------
async function cut() {
  const [clip, range] = pos;
  const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(range || '');
  if (!clip || !m) { console.log('usage: node tools/footage.mjs cut <clip> <from>-<to> [--name n] [--focus x,y] [--scale 1] [--fps n] [--sound]'); process.exit(1); }
  const file = path.resolve(clip);
  if (!fs.existsSync(file)) { console.error(`not found: ${clip}`); process.exit(1); }
  const info = probe(file);
  const a = Number(m[1]);
  const z = Math.min(Number(m[2]), info.dur || Infinity);
  if (!(z > a)) { console.error(`${range}: the stretch is empty (the clip is ${info.dur.toFixed(2)} s)`); process.exit(1); }
  const name = slug(String(flags.name || `${path.basename(file)}-${Math.round(a * 10)}`));
  const TL = await import(pathToFileURL(path.join(ROOT, 'js/timeline.mjs')).href);
  const scale = Number(flags.scale || 1);
  const OW = even(TL.W * scale); const OH = even(TL.H * scale);
  const k = Math.max(OW / info.w, OH / info.h);
  const sw = even(Math.ceil(info.w * k)); const sh = even(Math.ceil(info.h * k));
  const [fx, fy] = String(flags.focus || '0.5,0.5').split(',').map((v) => Math.min(1, Math.max(0, Number(v))));
  const cx = Math.round((sw - OW) * (Number.isFinite(fx) ? fx : 0.5));
  const cy = Math.round((sh - OH) * (Number.isFinite(fy) ? fy : 0.5));
  const fps = Number(flags.fps) || Math.min(60, Math.round(info.fps) || 30);
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (/^\d{5}\.jpg$/.test(f)) fs.rmSync(path.join(dir, f));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(a), '-i', file, '-t', String(z - a), '-an',
    '-vf', `fps=${fps},scale=${sw}:${sh}:flags=lanczos,crop=${OW}:${OH}:${cx}:${cy}`, '-q:v', '3', '-start_number', '0', path.join(dir, '%05d.jpg')], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`ffmpeg could not cut ${clip}: ${(r.stderr || '').trim().split('\n').pop()}`); process.exit(1); }
  const frames = fs.readdirSync(dir).filter((f) => /^\d{5}\.jpg$/.test(f)).length;
  const bytes = fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
  // the data module: read what is there, add this cut, write it back
  let data = {};
  if (fs.existsSync(DATA)) data = { ...(await import(`${pathToFileURL(DATA).href}?t=${Date.now()}`)).default };
  data[name] = { dir: `assets/footage/${name}`, fps, frames, w: OW, h: OH, clip: path.basename(file), from: a, to: r1(z), focus: [fx, fy] };
  fs.writeFileSync(DATA, `// Written by tools/footage.mjs cut — one entry per cut: { dir, fps, frames, w, h, clip, from, to, focus }.\nexport default ${JSON.stringify(data, null, 1)};\n`);
  console.log(`${name}: ${frames} frames at ${fps} fps (${(z - a).toFixed(2)} s of ${path.basename(file)} from ${a} s), ${OW}×${OH}, ${(bytes / 1e6).toFixed(1)} MB → assets/footage/${name}/`);
  if (flags.sound) {
    if (!info.sound) console.log('  (no sound in this clip)');
    else {
      const wav = path.join(ROOT, 'audio/kit', `${name}.wav`);
      fs.mkdirSync(path.dirname(wav), { recursive: true });
      const s = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(a), '-i', file, '-t', String(z - a), '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_f32le', wav], { encoding: 'utf8' });
      console.log(s.status === 0 ? `  its sound → audio/kit/${name}.wav (sample(t, 'audio/kit/${name}.wav', { align: 'start' }) — add a row to audio/kit/KIT.md)` : `  ! the sound could not be cut: ${(s.stderr || '').trim().split('\n').pop()}`);
    }
  }
}

export { probe, analyse, shift };

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  if (mode === 'scan') scan();
  else if (mode === 'cut') await cut();
  else {
    console.log('usage:\n  node tools/footage.mjs scan <video files or folders…>\n  node tools/footage.mjs cut <clip> <from>-<to> [--name n] [--focus x,y] [--scale 1] [--fps n] [--sound]');
    process.exit(1);
  }
}
