#!/usr/bin/env node
// Raster logo → vector shapes you can animate (letters one by one, strokes drawing on, a cut sweeping through).
// ffmpeg decodes (and upsamples) the image; a scalar field marks the logo's pixels; marching squares trace the outlines;
// Ramer–Douglas–Peucker simplifies them; nested loops become holes. The fit is checked: IoU of the traced shapes
// against the source mask (aim for ≥ 0.97).
//   node <skill>/scripts/trace-logo.mjs logo.png [--out assets/logo] [--mode auto|alpha|dark|light|color]
//        [--color "#fc0a0e"] [--tol 0.25] [--crop x,y,w,h] [--up 4] [--eps 0.15] [--min-area 6]
// Writes <out>.svg (one <path> per shape, fill-rule evenodd) and <out>.json ({ w, h, shapes: [{ d, box, area }] },
// sorted left → right). Multi-colour logos: run once per colour with --mode color --color <hex>.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const src = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!src || !fs.existsSync(src)) { console.log('usage: node trace-logo.mjs <image> [--out assets/logo] [--mode auto|alpha|dark|light|color] [--color #hex] [--crop x,y,w,h] [--up 4]'); process.exit(1); }
const out = path.resolve(opt('out', path.join(path.dirname(src), path.basename(src).replace(/\.\w+$/, '') + '-traced')));
const UP = Number(opt('up', 4)); // upsampling before tracing: smoother curves on small rasters
const EPS = Number(opt('eps', 0.15)); // simplification tolerance, in source pixels
const MIN_AREA = Number(opt('min-area', 6)); // shapes smaller than this (source px²) are specks, dropped
const TOL = Number(opt('tol', 0.25)); // colour distance (0..1.7 in RGB) counted as "the same colour"

const pr = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', src], { encoding: 'utf8' }).stdout || '{}');
const st = pr.streams?.[0];
if (!st) throw new Error(`ffprobe cannot read ${src}`);
const crop = opt('crop', null)?.split(',').map(Number) || [0, 0, st.width, st.height];
const [cx, cy, cw, ch] = crop;
const W = cw * UP; const H = ch * UP;
const decode = (w, h, scale) => spawnSync('ffmpeg', ['-v', 'error', '-i', src, '-vf', `crop=${cw}:${ch}:${cx}:${cy}${scale ? `,scale=${w}:${h}:flags=bicubic` : ''}`,
  '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 30 }).stdout;
const raw = decode(W, H, UP !== 1);
const base = decode(cw, ch, false);
if (!raw || raw.length < W * H * 4) throw new Error('ffmpeg could not decode the image');

// ---- the field: 1 = logo, 0 = background -------------------------------------------------------------------------------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.replace('#', '').padEnd(6, '0').slice(i - 1, i + 1), 16) / 255);
function makeField(buf, w, h) {
  let mode = opt('mode', 'auto');
  let bg = [1, 1, 1];
  if (mode === 'auto') {
    let minA = 255;
    const border = [];
    for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const i = (y * w + x) * 4; minA = Math.min(minA, buf[i + 3]); border.push([buf[i], buf[i + 1], buf[i + 2]]); }
    for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const i = (y * w + x) * 4; minA = Math.min(minA, buf[i + 3]); border.push([buf[i], buf[i + 1], buf[i + 2]]); }
    if (minA < 200) mode = 'alpha';
    else { mode = 'bg'; bg = [0, 1, 2].map((c) => { const v = border.map((p) => p[c]).sort((a, z) => a - z); return v[v.length >> 1] / 255; }); }
  }
  const target = mode === 'color' ? hex(opt('color', '#000000')) : bg;
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = buf[i * 4] / 255; const g = buf[i * 4 + 1] / 255; const b = buf[i * 4 + 2] / 255; const a = buf[i * 4 + 3] / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const dist = Math.hypot(r - target[0], g - target[1], b - target[2]);
    f[i] = mode === 'alpha' ? a : mode === 'dark' ? (1 - lum) * a : mode === 'light' ? lum * a : mode === 'color' ? Math.max(0, 1 - dist / TOL) * a : Math.min(1, dist / TOL) * a;
  }
  return { f, mode };
}
const { f: field, mode } = makeField(raw, W, H);

// ---- marching squares at 0.5, on a field padded with one pixel of background so every contour closes ------------------------
const PW = W + 2; const PH = H + 2;
const L = new Float32Array(PW * PH);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L[(y + 1) * PW + x + 1] = field[y * W + x];
const TH = 0.5;
const v = (x, y) => L[y * PW + x];
const pt = new Map(); const adj = new Map();
const cross = (x, y, d) => {
  const id = 2 * (y * PW + x) + d;
  if (!pt.has(id)) { const a = v(x, y); const b = d === 0 ? v(x + 1, y) : v(x, y + 1); const t = (TH - a) / (b - a); pt.set(id, d === 0 ? [x + t, y] : [x, y + t]); }
  return id;
};
const link = (a, b) => { if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push(b); adj.get(b).push(a); };
for (let y = 0; y < PH - 1; y++) {
  for (let x = 0; x < PW - 1; x++) {
    const c = (v(x, y) > TH ? 8 : 0) | (v(x + 1, y) > TH ? 4 : 0) | (v(x + 1, y + 1) > TH ? 2 : 0) | (v(x, y + 1) > TH ? 1 : 0);
    if (c === 0 || c === 15) continue;
    const T = () => cross(x, y, 0); const B = () => cross(x, y + 1, 0); const Lf = () => cross(x, y, 1); const Rt = () => cross(x + 1, y, 1);
    const centre = (v(x, y) + v(x + 1, y) + v(x + 1, y + 1) + v(x, y + 1)) / 4 > TH;
    switch (c) {
      case 1: case 14: link(Lf(), B()); break;
      case 2: case 13: link(B(), Rt()); break;
      case 3: case 12: link(Lf(), Rt()); break;
      case 4: case 11: link(T(), Rt()); break;
      case 6: case 9: link(T(), B()); break;
      case 7: case 8: link(Lf(), T()); break;
      case 5: if (centre) { link(Lf(), T()); link(B(), Rt()); } else { link(Lf(), B()); link(T(), Rt()); } break;
      case 10: if (centre) { link(T(), Rt()); link(Lf(), B()); } else { link(Lf(), T()); link(B(), Rt()); } break;
      default: break;
    }
  }
}
const seen = new Set(); const loops = [];
for (const start of adj.keys()) {
  if (seen.has(start)) continue;
  const loop = []; let prev = -1; let cur = start;
  for (let guard = 0; guard < 5e6; guard++) {
    seen.add(cur); loop.push(pt.get(cur));
    const nb = adj.get(cur); const next = nb[0] !== prev ? nb[0] : nb[1];
    prev = cur; cur = next;
    if (cur === start || cur === undefined) break;
  }
  if (loop.length > 8) loops.push(loop.map(([x, y]) => [(x - 1) / UP, (y - 1) / UP]));
}

const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i]; const [x1, y1] = p[(i + 1) % p.length]; a += x0 * y1 - x1 * y0; } return a / 2; };
const bbox = (p) => p.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9]);
function inside(q, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
    if ((yi > q[1]) !== (yj > q[1]) && q[0] < ((xj - xi) * (q[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function rdp(p, eps) {
  const keep = new Uint8Array(p.length);
  const rec = (a, z) => {
    let best = -1; let bi = -1;
    const [ax, ay] = p[a]; const [zx, zy] = p[z % p.length];
    const dx = zx - ax; const dy = zy - ay; const len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < z; i++) { const [px, py] = p[i]; const d = Math.abs(dy * px - dx * py + zx * ay - zy * ax) / len; if (d > best) { best = d; bi = i; } }
    if (best > eps) { keep[bi] = 1; rec(a, bi); rec(bi, z); }
  };
  let far = 0; let fi = 0;
  for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]); if (d > far) { far = d; fi = i; } }
  keep[0] = 1; keep[fi] = 1; rec(0, fi); rec(fi, p.length);
  return p.filter((_, i) => keep[i]);
}

const big = loops.filter((p) => Math.abs(area(p)) > MIN_AREA).map((p) => rdp(p, EPS));
const outers = []; const holes = [];
for (const p of big) {
  const depth = big.filter((q) => q !== p && Math.abs(area(q)) > Math.abs(area(p)) && inside(p[0], q)).length;
  (depth % 2 === 0 ? outers : holes).push(p);
}
if (!outers.length) { console.error(`nothing traced (mode ${mode}); try --mode dark|light|color --color #hex, or --crop to the logo`); process.exit(1); }
outers.sort((a, z) => bbox(a)[0] - bbox(z)[0] || bbox(a)[1] - bbox(z)[1]);
const all = outers.flat();
const [bx0, by0, bx1, by1] = bbox(all);
const r2 = (n) => Math.round(n * 100) / 100;
const toPath = (p) => `M${p.map(([x, y]) => `${r2(x - bx0)} ${r2(y - by0)}`).join('L')}Z`;
const shapes = outers.map((o) => {
  const hs = holes.filter((h) => inside(h[0], o) && !outers.some((o2) => o2 !== o && Math.abs(area(o2)) < Math.abs(area(o)) && inside(h[0], o2)));
  const b = bbox(o);
  return { d: [o, ...hs].map(toPath).join(''), box: [r2(b[0] - bx0), r2(b[1] - by0), r2(b[2] - bx0), r2(b[3] - by0)], area: r2(Math.abs(area(o)) - hs.reduce((s, h) => s + Math.abs(area(h)), 0)) };
});

// ---- fit check: rasterise the traced shapes (even-odd scanlines) and compare with the source mask ------------------------------
const { f: srcField } = makeField(base, cw, ch);
const polys = [...outers, ...holes];
let inter = 0; let uni = 0;
for (let y = 0; y < ch; y++) {
  const yc = y + 0.5;
  const xs = [];
  for (const p of polys) for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i]; const [x1, y1] = p[(i + 1) % p.length];
    if ((y0 > yc) !== (y1 > yc)) xs.push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0));
  }
  xs.sort((a, z) => a - z);
  const row = new Uint8Array(cw);
  for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x < Math.min(cw, Math.ceil(xs[k + 1] - 0.5)); x++) row[x] = 1;
  for (let x = 0; x < cw; x++) { const a = row[x]; const b = srcField[y * cw + x] > TH ? 1 : 0; inter += a & b; uni += a | b; }
}
const iou = uni ? inter / uni : 0;

const w = r2(bx1 - bx0); const h = r2(by1 - by0);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(`${out}.json`, JSON.stringify({ source: path.basename(src), crop, mode, w, h, origin: [r2(bx0 + cx), r2(by0 + cy)], iou: r2(iou), shapes }, null, 1));
fs.writeFileSync(`${out}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n${shapes.map((s) => `  <path fill="currentColor" fill-rule="evenodd" d="${s.d}"/>`).join('\n')}\n</svg>\n`);
console.log(`${shapes.length} shapes (${holes.length} holes), ${w}×${h} px, mode ${mode}, fit IoU ${iou.toFixed(3)}${iou < 0.97 ? '  ← check: try --up 6, a smaller --eps, --crop, or another --mode' : ''}`);
console.log(`wrote ${out}.svg and ${out}.json`);
