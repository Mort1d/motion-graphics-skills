#!/usr/bin/env node
// Final render: N headless-browser workers pull 2-second chunks from a queue (with motion blur), the chunks are
// joined losslessly, the score is muxed in, then the delivery files are encoded and checked.
//
//   node tools/render.mjs                         full quality → out/<name>.mp4, out/<name>-web.mp4, out/covers/*.png
//   node tools/render.mjs --draft                 fast preview (half size, no motion blur) → out/<name>-draft.mp4
//   node tools/render.mjs --range 12-18           re-render only the chunks that touch 12–18 s, reuse the rest
//   node tools/render.mjs --skip-frames           re-mux / re-encode from the cached chunks (new score, new grain)
// Flags: --jobs N (parallel browsers, default ≈ CPU threads / 3), --sub 16 (max blur samples per frame),
//        --chunk 2 (seconds), --query "lang=en" (page query; the tag becomes <name>-en), --audio <wav>,
//        --out <mp4>, --crf 15, --grain 3 (0 = off), --no-web, --no-covers, --no-qa.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodeAac, loudness, report } from './aac.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const has = (k) => args.includes(`--${k}`);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };

const TL = await import(pathToFileURL(path.join(ROOT, 'js/timeline.mjs')).href);
const COPY = fs.existsSync(path.join(ROOT, 'js/copy.mjs')) ? await import(pathToFileURL(path.join(ROOT, 'js/copy.mjs')).href) : {};
const FPS = TL.FPS ?? 60;
const DURATION = TL.DURATION;
if (!DURATION) throw new Error('js/timeline.mjs must export DURATION (seconds)');

const draft = has('draft');
const query = opt('query', '');
const lang = new URLSearchParams(query).get('lang');
const slug = (COPY.SLUG || String(COPY.BRAND || 'promo')).toLowerCase().normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'promo';
const tag = `${slug}${lang ? `-${lang}` : ''}${draft ? '-draft' : ''}`;
const out = opt('out') ? path.resolve(opt('out')) : path.join(ROOT, `out/${tag}.mp4`);
const jobs = Math.max(1, Number(opt('jobs', Math.max(1, Math.min(6, Math.round(os.cpus().length / 3))))));
const sub = draft ? 1 : Number(opt('sub', 16));
const scale = Number(opt('scale', draft ? 0.5 : 1));
const chunkSec = Number(opt('chunk', 2));
const crf = opt('crf', draft ? '23' : '15');
const grain = Number(opt('grain', draft ? 0 : 3));
const audioPath = opt('audio') ? path.resolve(opt('audio')) : path.join(ROOT, `out/music${lang ? `-${lang}` : ''}.wav`);
const cacheDir = path.join(ROOT, '.cache', 'render', tag);
fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });

const run = (cmd, a, label) => new Promise((resolve, reject) => {
  const p = spawn(cmd, a, { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited ${code}`))));
});
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// ---- chunks -------------------------------------------------------------------------------------------------------
const frames = Math.round(DURATION * FPS);
const per = Math.max(1, Math.round(chunkSec * FPS));
const chunks = [];
for (let f0 = 0, id = 0; f0 < frames; f0 += per, id++) {
  const f1 = Math.min(frames, f0 + per);
  chunks.push({ id, f0, f1, out: path.join(cacheDir, `c${String(f0).padStart(6, '0')}-${f1}-s${sub}-x${scale}.mp4`) });
}
let todo = chunks;
const range = opt('range', null);
if (has('skip-frames')) todo = [];
else if (range) {
  const [a, z] = range.split('-').map((x) => (x.endsWith('b') ? Number(x.slice(0, -1)) * TL.BEAT : Number(x))); // seconds, or beats: 24b-32b
  todo = chunks.filter((c) => c.f1 / FPS > a && c.f0 / FPS < z);
  const missing = chunks.filter((c) => !todo.includes(c) && !fs.existsSync(c.out));
  if (missing.length) todo = [...todo, ...missing];
}
const absent = chunks.filter((c) => !todo.includes(c) && !fs.existsSync(c.out));
if (absent.length) throw new Error(`missing cached chunks (${absent.length}); render without --skip-frames first`);

// what the frames are made of: an edit during the render would mix old and new code across chunks
const sourceState = () => {
  const out = new Map();
  const walk = (d) => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, f.name); if (f.isDirectory()) walk(q); else { const st = fs.statSync(q); out.set(path.relative(ROOT, q), `${st.size}|${st.mtimeMs}`); } } };
  for (const d of ['js', 'css', 'assets']) walk(path.join(ROOT, d));
  for (const f of ['index.html']) if (fs.existsSync(path.join(ROOT, f))) { const st = fs.statSync(path.join(ROOT, f)); out.set(f, `${st.size}|${st.mtimeMs}`); }
  return out;
};
const before = sourceState();

const t0 = Date.now();
if (todo.length) {
  console.log(`${tag}: ${todo.length}/${chunks.length} chunks of ${chunkSec} s, ${jobs} workers, ${sub > 1 ? `up to ${sub} blur samples` : 'no motion blur'}, scale ${scale}`);
  await new Promise((resolve, reject) => {
    const queue = [...todo];
    const retries = new Map();
    let active = 0;
    let finished = 0;
    let failedHard = null;
    const n = Math.min(jobs, queue.length);
    const workerArgs = ['worker', '--sub', String(sub), '--scale', String(scale), ...(query ? ['--query', query] : [])];
    const give = (w) => {
      const job = queue.shift();
      if (!job) { w.send({ quit: true }); return; }
      w.job = job;
      w.send({ job: { id: job.id, f0: job.f0, f1: job.f1, out: job.out } });
    };
    for (let i = 0; i < n; i++) {
      const w = fork(path.join(HERE, 'capture.mjs'), [...workerArgs, '--slot', String(i)], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      active++;
      w.on('message', (m) => {
        if (m.ready) give(w);
        else if (m.done) {
          finished++;
          const el = (Date.now() - t0) / 1000;
          const eta = (el / finished) * (todo.length - finished);
          console.log(`chunk ${String(m.done.id).padStart(3)} ${(w.job.f0 / FPS).toFixed(1)}–${(w.job.f1 / FPS).toFixed(1)} s  ${m.done.secs.toFixed(0)} s  [${finished}/${todo.length}, ${fmt(el)} elapsed, ~${fmt(eta)} left]`);
          give(w);
        } else if (m.failed) {
          console.error(`chunk ${m.failed.id} failed:\n${m.failed.error}`);
          const k = (retries.get(m.failed.id) || 0) + 1;
          retries.set(m.failed.id, k);
          if (k <= 1) queue.push(w.job); else failedHard = new Error(`chunk ${m.failed.id} failed twice`);
          give(w);
        }
      });
      w.on('exit', (code) => {
        active--;
        if (code && w.job && !failedHard && finished < todo.length) {
          const k = (retries.get(w.job.id) || 0) + 1;
          retries.set(w.job.id, k);
          if (k <= 1) queue.push(w.job); else failedHard = new Error(`worker died twice on chunk ${w.job.id}`);
        }
        if (active === 0) {
          if (failedHard) reject(failedHard);
          else if (finished < todo.length) reject(new Error(`${todo.length - finished} chunks were not rendered`));
          else resolve();
        }
      });
    }
  });
  console.log(`frames done in ${fmt((Date.now() - t0) / 1000)}`);
  const after = sourceState();
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter((k) => before.get(k) !== after.get(k));
  if (changed.length) {
    console.warn(`WARNING: the project changed during the render (${changed.slice(0, 4).join(', ')}${changed.length > 4 ? ', …' : ''}): chunks rendered before and after the edit mix two versions. Re-render what the edit touches (--range a-b) or everything; next time let a render finish before editing.`);
  }
}

// ---- join, mux, deliver ---------------------------------------------------------------------------------------------
const list = path.join(cacheDir, 'chunks.txt');
fs.writeFileSync(list, chunks.map((c) => `file '${c.out.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
const joined = path.join(cacheDir, 'frames.mp4');
await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined], 'concat');

const hasAudio = fs.existsSync(audioPath);
if (!hasAudio) console.warn(`WARNING: no score at ${path.relative(ROOT, audioPath)} — the video is silent. Run: node audio/score.mjs${lang ? ` --lang ${lang}` : ''}`);
// light temporal grain kills banding in gradients; even dimensions for 4:2:0
const vf = `${grain > 0 ? `noise=c0s=${grain}:c0f=t,` : ''}scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`;
// the audio is encoded and measured on its own (tools/aac.mjs), then copied in as is
const encode = async (file, c, abr, extra = []) => {
  const aac = path.join(cacheDir, `score-${abr}.m4a`);
  const sound = hasAudio ? await encodeAac(audioPath, aac, { bitrate: abr }) : null;
  // written beside the file and moved over it only when complete: a failed encode never costs the last good master
  const part = file.replace(/\.mp4$/, '.partial.mp4');
  await run('ffmpeg', ['-v', 'error', '-y', '-i', joined, ...(sound ? ['-i', aac] : []),
    '-filter_complex', `[0:v]${vf}[v]`, '-map', '[v]', ...(sound ? ['-map', '1:a', '-c:a', 'copy'] : []),
    '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', String(c), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-t', String(DURATION), '-movflags', '+faststart', ...extra, part], path.basename(file));
  try { fs.renameSync(part, file); } catch (e) {
    throw new Error(`the new ${path.basename(file)} is at ${path.relative(ROOT, part)}: the old one could not be replaced (${e.code || e.message} — open in a player?)`);
  }
  console.log(`wrote ${path.relative(ROOT, file)}`);
  if (sound) console.log(`  ${report('audio', await loudness(file).then((m) => ({ ...m, gain: sound.gain })))}`);
};

await encode(out, crf, '320k');
if (!draft && !has('no-web')) await encode(out.replace(/\.mp4$/, '-web.mp4'), 21, '192k', ['-maxrate', '12M', '-bufsize', '24M']);
if (!draft && !has('no-covers') && TL.COVERS?.length) {
  const dir = path.join(path.dirname(out), 'covers');
  await run(process.execPath, [path.join(HERE, 'capture.mjs'), 'still', ...TL.COVERS.map(String), '--out', dir, '--prefix', `${tag}-t`,
    ...(query ? ['--query', query] : []), '--quiet'], 'covers');
}
if (!has('no-qa')) await run(process.execPath, [path.join(HERE, 'qa.mjs'), out, ...(draft ? ['--draft'] : [])], 'qa').catch((e) => { process.exitCode = 1; console.error(e.message); });
console.log(`total ${fmt((Date.now() - t0) / 1000)}`);
