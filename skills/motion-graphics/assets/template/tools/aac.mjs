#!/usr/bin/env node
// Delivery audio that never peaks over the ceiling. FFmpeg's own AAC encoder can overshoot by several dB: a score at
// −5.1 dBTP came out at 0.0 dBTP in a 192k copy. Most of it is noise substitution and intensity stereo, which the
// player's decoder rebuilds (noise substitution even differs from player to player). Both are off here, since a music
// master has the bits for real bands. Every encode is measured after decoding, and one that still peaks over the
// ceiling is encoded again, quieter by the excess.
//   node tools/aac.mjs <file>…        loudness and true peak of any audio or video file
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CEILING = -1; // dBTP, decoded

const ffmpeg = (args) => new Promise((resolve, reject) => {
  const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; if (err.length > 1 << 20) err = err.slice(-(1 << 19)); });
  p.on('error', (e) => reject(new Error(e.code === 'ENOENT' ? 'ffmpeg is not installed or not on PATH' : e.message)));
  p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg exited ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}`))));
});
const num = (s) => (s === undefined ? NaN : s === '-inf' ? -Infinity : Number(s));

// integrated loudness (LUFS) and true peak (dBTP) of the decoded audio
export async function loudness(file) {
  const err = await ffmpeg(['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const sum = err.slice(err.lastIndexOf('Summary:'));
  return { lufs: num(sum.match(/I:\s+(-?[\d.]+|-inf) LUFS/)?.[1]), tp: num(sum.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/)?.[1]) };
}

// Encodes the audio of `input` to an AAC file whose decoded true peak is at most `ceiling`.
// Returns { lufs, tp, gain }: gain is below 0 when the audio had to be turned down.
export async function encodeAac(input, file, { bitrate = '256k', ceiling = CEILING } = {}) {
  let gain = 0;
  for (let attempt = 1; ; attempt++) {
    await ffmpeg(['-v', 'error', '-y', '-i', input, '-vn', ...(gain ? ['-af', `volume=${gain.toFixed(2)}dB`] : []),
      '-c:a', 'aac', '-aac_pns', '0', '-aac_is', '0', '-b:a', bitrate, '-ar', '48000', file]);
    const m = await loudness(file);
    if (Number.isNaN(m.tp)) throw new Error(`${path.basename(file)}: could not measure the true peak (ffmpeg's ebur128 summary is missing)`);
    if (!(m.tp > ceiling)) return { ...m, gain };
    if (attempt === 3) throw new Error(`${path.basename(file)}: true peak ${m.tp} dBTP after 3 encodes (ceiling ${ceiling}); lower the score's own peak`);
    gain -= m.tp - ceiling + 0.2;
  }
}

export const report = (name, m) => `${name}: ${m.lufs.toFixed(1)} LUFS, true peak ${m.tp.toFixed(1)} dBTP${m.gain ? ` (turned down ${(-m.gain).toFixed(1)} dB: the encoder overshot)` : ''}`;

// run as a command (compared as real paths: a symlink or a junction in the path must not turn the CLI off)
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node tools/aac.mjs <file>…'); process.exit(1); }
  for (const f of files) {
    try {
      const m = await loudness(f);
      if (Number.isNaN(m.tp)) throw new Error('no audio to measure');
      console.log(`${report(f, m)}${m.tp > CEILING ? `  — over ${CEILING} dBTP: players may clip` : ''}`);
      if (m.tp > CEILING) process.exitCode = 1;
    } catch (e) { console.error(`${f}: ${e.message}`); process.exitCode = 1; }
  }
}
