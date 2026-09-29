#!/usr/bin/env node
// The timeline for another engine: js/timeline.mjs as JSON in seconds and in frames — scene windows, named cues, the
// energy plan, the fast moves — next to the score it was composed for (out/music.wav). A Remotion composition places
// its <Sequence from={fromFrame} durationInFrames={frames}> and its <Audio> from it, a HyperFrames page its clips; the
// cuts still land on the beats the music was written to.
//   node tools/export-timeline.mjs [--out out/timeline.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const out = path.resolve(oi >= 0 ? args[oi + 1] : path.join(ROOT, 'out/timeline.json'));
const TL = await import(pathToFileURL(path.join(ROOT, 'js/timeline.mjs')).href);
const fr = (t) => Math.round(t * TL.FPS);
const r3 = (t) => Math.round(t * 1000) / 1000;
const json = {
  width: TL.W, height: TL.H, fps: TL.FPS, bpm: TL.BPM, duration: r3(TL.DURATION), durationInFrames: fr(TL.DURATION),
  audio: fs.existsSync(path.join(ROOT, 'out/music.wav')) ? 'out/music.wav' : null,
  scenes: Object.fromEntries(Object.entries(TL.S || {}).map(([k, [a, z]]) => [k, { from: r3(a), to: r3(z), fromFrame: fr(a), frames: fr(z) - fr(a), energy: TL.ENERGY?.[k] ?? null }])),
  cues: Object.fromEntries(Object.entries(TL.CUE || {}).map(([k, t]) => [k, { t: r3(t), frame: fr(t), beat: r3(t / TL.BEAT) }])),
  whips: (TL.WHIPS || []).map(([a, z]) => ({ from: r3(a), to: r3(z), fromFrame: fr(a), toFrame: fr(z) })),
  loop: !!TL.LOOP,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(json, null, 1));
console.log(`${path.relative(ROOT, out)}: ${Object.keys(json.scenes).length} scenes, ${Object.keys(json.cues).length} cues, ${json.durationInFrames} frames at ${json.fps} fps${json.audio ? `, audio ${json.audio}` : ' (no out/music.wav yet: node audio/score.mjs)'}`);
