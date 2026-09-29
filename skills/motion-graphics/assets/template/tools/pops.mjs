#!/usr/bin/env node
// Single-frame pops: a frame that differs from BOTH of its neighbours while they look alike — a glitch the eye misses
// at full speed and a viewer notices on the third loop (a scene drawn a frame early, a number that blinks, text that
// jumps and jumps back). Measured on small grey thumbnails of every frame: frame k pops when it is far from k−1 and from
// k+1 but k−1 and k+1 are close. A hard cut, a slam, a whip or a flash keeps going (k+1 is not back to k−1): none counts.
//   node tools/pops.mjs out/<name>.mp4     lists the pops (qa.mjs runs the same scan)
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Every frame of a video as a grey thumbnail `w` px wide → { frames: Buffer, w, h, n }. */
export function thumbs(file, w = 96) {
  const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [W, H] = (p.stdout || '').trim().split(',').map(Number);
  if (!W || !H) throw new Error(`cannot read the video size of ${file}`);
  const h = Math.max(2, 2 * Math.round((w * H) / W / 2));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', 'pipe:1'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${file}: ${String(r.stderr || '').slice(-300)}`);
  return { frames: r.stdout, w, h, n: Math.floor(r.stdout.length / (w * h)) };
}

/** Mean absolute difference (0–255) between frames i and j. */
function diff({ frames, w, h }, i, j) {
  const s = w * h;
  let d = 0;
  for (let k = 0, a = i * s, b = j * s; k < s; k++) d += Math.abs(frames[a + k] - frames[b + k]);
  return d / s;
}

/**
 * Pops in a thumbnail sequence: frame k is `min(in, out) ≥ floor` away from both neighbours while the neighbours are
 * within `back` × that of each other.
 * @returns {{ frame: number, t: number, into: number, out: number, across: number }[]}
 */
export function findPops(v, { fps = 60, floor = 4, back = 0.35 } = {}) {
  const pops = [];
  for (let k = 1; k < v.n - 1; k++) {
    const into = diff(v, k - 1, k);
    if (into < floor) continue;
    const out = diff(v, k, k + 1);
    if (out < floor) continue;
    const across = diff(v, k - 1, k + 1);
    if (across < back * Math.min(into, out)) {
      pops.push({ frame: k, t: Math.round((k / fps) * 1000) / 1000, into, out, across });
      k++;
    }
  }
  return pops;
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const file = process.argv[2];
  if (!file) { console.log('usage: node tools/pops.mjs <video>'); process.exit(1); }
  const fps = Number((spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout || '60/1').trim().split('/').reduce((a, b) => a / b));
  const pops = findPops(thumbs(file), { fps });
  if (!pops.length) console.log('no single-frame pops');
  for (const p of pops) console.log(`${p.t.toFixed(3)} s (frame ${p.frame}): differs ${p.into.toFixed(1)} / ${p.out.toFixed(1)} from its neighbours, which differ ${p.across.toFixed(1)}`);
}
