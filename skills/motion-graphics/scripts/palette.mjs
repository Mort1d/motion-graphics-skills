#!/usr/bin/env node
// Brand colours from a logo or a screenshot: k-means over the pixels (seeded, repeatable), near-duplicates merged,
// each colour reported as its most frequent exact value with its share and a guessed role, plus a swatch strip PNG.
// Small saturated colours are kept even below the cut: an accent is small by nature (a button, a logo mark).
//   node <skill>/scripts/palette.mjs logo.png [--k 6] [--crop x,y,w,h] [--out refs/palette.png]
// Needs ffmpeg. Paste the hexes into css/style.css tokens (--bg, --text, --accent, --accent-2, ...).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const src = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!src || !fs.existsSync(src)) { console.log('usage: node palette.mjs <image> [--k 6] [--crop x,y,w,h] [--out palette.png]'); process.exit(1); }
const K = Math.max(2, Math.min(12, Number(opt('k', 6))));
const crop = opt('crop', null);
const SIDE = 320; // analyse a small copy: enough pixels for thin accents, still fast
// nearest-neighbour keeps the file's exact colours (a smooth scaler would blend a logo's fill into its edges)
const vf = `${crop ? `crop=${crop.split(',').join(':')},` : ''}scale=${SIDE}:${SIDE}:force_original_aspect_ratio=decrease:flags=neighbor`;
const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', src, '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 26 }).stdout;
if (!raw || !raw.length) throw new Error('ffmpeg could not decode the image');
const px = [];
for (let i = 0; i < raw.length; i += 4) if (raw[i + 3] > 128) px.push([raw[i], raw[i + 1], raw[i + 2]]);
if (!px.length) throw new Error('the image is fully transparent');

// over-cluster (a dark vignette alone eats several clusters), then merge the near-duplicates
const KK = Math.min(24, Math.max(12, K * 2));
let s = 12345; // fixed seed → the same palette every run
const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const cent = [px[Math.floor(rnd() * px.length)]];
const near = new Float64Array(px.length).fill(Infinity);
while (cent.length < KK) { // k-means++ seeding
  const c = cent[cent.length - 1];
  let tot = 0;
  for (let i = 0; i < px.length; i++) { near[i] = Math.min(near[i], d2(px[i], c)); tot += near[i]; }
  if (!tot) break; // fewer distinct colours than clusters
  let r = rnd() * tot; let idx = 0;
  while (r > near[idx] && idx < px.length - 1) { r -= near[idx]; idx++; }
  cent.push(px[idx]);
}
const assign = new Int32Array(px.length);
for (let it = 0; it < 16; it++) {
  for (let i = 0; i < px.length; i++) { let best = 0; let bd = Infinity; for (let j = 0; j < cent.length; j++) { const d = d2(px[i], cent[j]); if (d < bd) { bd = d; best = j; } } assign[i] = best; }
  const sum = cent.map(() => [0, 0, 0, 0]);
  px.forEach((p, i) => { const q = sum[assign[i]]; q[0] += p[0]; q[1] += p[1]; q[2] += p[2]; q[3]++; });
  sum.forEach((q, j) => { if (q[3]) cent[j] = [q[0] / q[3], q[1] / q[3], q[2] / q[3]]; });
}
// each cluster's most frequent exact colour: a flat fill wins over its anti-aliased edges, the mean would not
let groups = cent.map((c, j) => ({ c, n: 0, modes: new Map(), id: j }));
px.forEach((p, i) => { const g = groups[assign[i]]; g.n++; const key = (p[0] << 16) | (p[1] << 8) | p[2]; g.modes.set(key, (g.modes.get(key) || 0) + 1); });
groups = groups.filter((g) => g.n).sort((a, b) => b.n - a.n);
const MERGE = 26 ** 2; // RGB distance under which two clusters read as one colour
for (let a = 0; a < groups.length; a++) for (let b = groups.length - 1; b > a; b--) {
  if (d2(groups[a].c, groups[b].c) > MERGE) continue;
  for (const [k, n] of groups[b].modes) groups[a].modes.set(k, (groups[a].modes.get(k) || 0) + n);
  groups[a].n += groups[b].n; groups.splice(b, 1);
}
const modeOf = (g) => { let best = 0; let bn = -1; for (const [k, n] of g.modes) if (n > bn) { bn = n; best = k; } return [best >> 16, (best >> 8) & 255, best & 255]; };
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const sat = (c) => { const mx = Math.max(...c); const mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
const all = groups.map((g) => { const c = modeOf(g); return { c, hex: hex(c), share: g.n / px.length, lum: lum(c), sat: sat(c) }; })
  .sort((a, b) => b.share - a.share);
const isAccent = (r) => r.sat > 0.45 && r.lum > 0.12;
const hue = ([R, G, B]) => { const mx = Math.max(R, G, B); const d = mx - Math.min(R, G, B); if (!d) return 0; const h = mx === R ? (G - B) / d : mx === G ? 2 + (B - R) / d : 4 + (R - G) / d; return ((h * 60) + 360) % 360; };
const sameHue = (a, b) => { const d = Math.abs(hue(a.c) - hue(b.c)); return Math.min(d, 360 - d) < 18; };
const rows = all.filter((r) => r.share >= 0.005).slice(0, K);
// small accents below the cut: one per hue (a glow's darker shades are the same colour), the purest one
const extras = all.filter((r) => !rows.includes(r) && isAccent(r) && r.share >= 0.0005)
  .sort((a, b) => b.sat * (0.5 + b.lum) - a.sat * (0.5 + a.lum));
for (const r of extras) if (!rows.some((q) => isAccent(q) && sameHue(q, r))) rows.push(r);
console.log(`${path.basename(src)}: ${rows.length} colours`);
for (const r of rows) {
  const role = r.share > 0.35 && (r.lum > 0.9 || r.lum < 0.08) ? 'background?' : isAccent(r) ? 'accent candidate' : r.lum < 0.2 ? 'dark / ink' : r.lum > 0.85 ? 'light / text' : 'neutral';
  console.log(`  ${r.hex}  ${(r.share * 100).toFixed(2).padStart(6)} %  ${role}`);
}
const out = path.resolve(opt('out', path.join(path.dirname(src), `${path.basename(src).replace(/\.\w+$/, '')}-palette.png`)));
const inputs = rows.flatMap((r) => ['-f', 'lavfi', '-i', `color=c=${r.hex.replace('#', '0x')}:s=120x120:d=1`]);
const graph = rows.length > 1 ? `${rows.map((_, i) => `[${i}:v]`).join('')}hstack=inputs=${rows.length}` : '[0:v]null';
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-frames:v', '1', out]);
if (r.status === 0) console.log(`swatches: ${out}`);
else console.log(`swatches not written: ${String(r.stderr).trim().split('\n').pop()}`);
