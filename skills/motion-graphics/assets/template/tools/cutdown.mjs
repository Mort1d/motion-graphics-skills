#!/usr/bin/env node
// A short cut (a 15-second social version, a teaser) from the rendered frames and the score: picks ranges of the
// timeline, joins them with the music cut along (20 ms fades at the joins so nothing clicks, a longer fade at the end),
// then runs the delivery check on the result (--no-qa skips it).
// Cut on bars so the music stays in time: a range like "8b-16b" is beats; plain numbers are seconds.
//   node tools/cutdown.mjs --ranges "0b-8b,16b-24b,44b-52b" [--query lang=en] [--out out/<slug>-15s.mp4] [--no-qa]
// Needs a finished render (tools/render.mjs) of the same cut: it reads .cache/render/<tag>/frames.mp4.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodeAac, loudness, report } from './aac.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const TL = await import(pathToFileURL(path.join(ROOT, 'js/timeline.mjs')).href);
const COPY = await import(pathToFileURL(path.join(ROOT, 'js/copy.mjs')).href);
const lang = new URLSearchParams(opt('query', '')).get('lang');
const slug = (COPY.SLUG || String(COPY.BRAND || 'promo')).toLowerCase().normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'promo'; // as render.mjs names it
const tag = `${slug}${lang ? `-${lang}` : ''}`;
const frames = path.join(ROOT, '.cache', 'render', tag, 'frames.mp4');
const music = opt('audio') ? path.resolve(opt('audio')) : path.join(ROOT, `out/music${lang ? `-${lang}` : ''}.wav`);
const out = opt('out') ? path.resolve(opt('out')) : path.join(ROOT, `out/${tag}-cut.mp4`);
const spec = opt('ranges', null);
if (!spec) { console.error('usage: node tools/cutdown.mjs --ranges "0b-8b,16b-24b" [--query lang=xx] [--out out/x.mp4]'); process.exit(1); }
if (!fs.existsSync(frames)) { console.error(`no rendered frames at ${path.relative(ROOT, frames)} — run node tools/render.mjs${lang ? ` --query lang=${lang}` : ''} first`); process.exit(1); }
if (!fs.existsSync(music)) { console.error(`no score at ${path.relative(ROOT, music)}`); process.exit(1); }

const sec = (s) => (s.endsWith('b') ? Number(s.slice(0, -1)) * TL.BEAT : Number(s));
const snap = (t) => Math.round(t * TL.FPS) / TL.FPS;
const parts = spec.split(',').map((r) => r.trim().split('-').map(sec).map(snap));
for (const [a, z] of parts) if (!(z > a) || a < 0 || z > TL.DURATION + 0.01) throw new Error(`bad range ${a}-${z} (0 … ${TL.DURATION} s)`);
const total = parts.reduce((s, [a, z]) => s + z - a, 0);

const cache = path.dirname(frames);
const ffmpeg = (a) => new Promise((resolve, reject) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: 'inherit' });
  p.on('error', reject);
  p.on('close', (code) => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve()));
});

// the music first, cut along the same ranges (20 ms fades at the joins, a longer one at the end), then encoded and
// measured on its own (tools/aac.mjs) and copied in under the picture
let fa = '';
let fv = '';
parts.forEach(([a, z], i) => {
  const tail = i === parts.length - 1 ? Math.min(0.45, (z - a) / 3) : 0.02;
  fa += `[0:a]atrim=start=${a}:end=${z},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=${(z - a - tail).toFixed(4)}:d=${tail}[a${i}];`;
  fv += `[0:v]trim=start=${a}:end=${z},setpts=PTS-STARTPTS[v${i}];`;
});
fa += `${parts.map((_, i) => `[a${i}]`).join('')}concat=n=${parts.length}:v=0:a=1[a]`;
fv += `${parts.map((_, i) => `[v${i}]`).join('')}concat=n=${parts.length}:v=1:a=0[vc];[vc]noise=c0s=3:c0f=t,format=yuv420p[v]`;
// named after this cut, so two cuts made at once do not swap their sound; float, so nothing clips before the encoder
const base = path.join(cache, `cut-${path.basename(out, path.extname(out))}`);
const wav = `${base}.wav`;
const aac = `${base}.m4a`;
try {
  await ffmpeg(['-i', music, '-filter_complex', fa, '-map', '[a]', '-c:a', 'pcm_f32le', '-ar', '48000', wav]);
  const sound = await encodeAac(wav, aac, { bitrate: '256k' });
  await ffmpeg(['-i', frames, '-i', aac, '-filter_complex', fv, '-map', '[v]', '-map', '1:a', '-c:a', 'copy',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(TL.FPS),
    '-movflags', '+faststart', out]);
  console.log(`wrote ${path.relative(ROOT, out)} (${total.toFixed(2)} s from ${parts.length} ranges)`);
  console.log(`  ${report('audio', { ...(await loudness(out)), gain: sound.gain })}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
} finally {
  for (const f of [wav, aac]) fs.rmSync(f, { force: true });
}
if (!args.includes('--no-qa')) {
  const qa = spawn(process.execPath, [path.join(HERE, 'qa.mjs'), out, '--cut'], { cwd: ROOT, stdio: 'inherit' });
  qa.on('error', (e) => { console.error(`qa: ${e.message}`); process.exitCode = 1; });
  qa.on('close', (code) => { if (code) process.exitCode = 1; });
}
