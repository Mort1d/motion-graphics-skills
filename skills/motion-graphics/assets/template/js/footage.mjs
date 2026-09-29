// The person's footage, cut by tools/footage.mjs into frame sequences (assets/footage/<name>/00000.jpg …): which frame
// is on screen at a source second, and speed ramps (output time → source time) as smooth curves. Plain ESM, no DOM:
// the picture picks its frames with it, the score places footsteps and the natural sound on the same ramp.
import CUTS from './footage.data.mjs';

export { CUTS };

/** The cut's length in seconds of source. */
export const lengthOf = (name) => { const c = cut(name); return c.frames / c.fps; };

function cut(name) {
  const c = CUTS[name];
  if (!c) throw new Error(`no footage cut "${name}" in js/footage.data.mjs — run: node tools/footage.mjs cut <clip> <from>-<to> --name ${name}`);
  return c;
}

const file = (c, i) => `${c.dir}/${String(i).padStart(5, '0')}.jpg`;

/**
 * The frame of a cut at source second s (from the cut's own start, clamped to it): { url, next, mix }. Pass next and
 * mix to screen.draw() and a slowed shot blends two neighbouring frames instead of stuttering; blend: false for a
 * hard, stepped look (a freeze, a stutter on purpose).
 */
export function frame(name, s, { blend = true } = {}) {
  const c = cut(name);
  const x = Math.max(0, Math.min(c.frames - 1, s * c.fps));
  const i = Math.floor(x);
  const j = Math.min(c.frames - 1, i + 1);
  return { url: file(c, i), next: blend && j !== i ? file(c, j) : null, mix: blend ? x - i : 0 };
}

/** The urls a frame() result needs decoded — for render.needs(t). */
export const urls = (fr) => (fr.next ? [fr.url, fr.next] : [fr.url]);

/**
 * A monotone cubic through [[x, y], …] sorted by x (Fritsch–Carlson): no overshoot, flat where two keys are equal, the
 * end values held outside the keys. For a speed ramp the keys are [output second, source second]: equal source seconds
 * freeze the frame, a steeper stretch runs faster than life, a shallow one is slow motion. f.speed(x) is the rate.
 */
export function remap(pts) {
  const n = pts.length;
  if (n < 2) { const y = pts[0]?.[1] ?? 0; const f = () => y; f.speed = () => 0; return f; }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const c = m[i + 1] / d[i];
    const s = a * a + c * c;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * c * d[i]; }
  }
  const seg = (x) => { let i = 0; while (i < n - 2 && x > xs[i + 1]) i++; return i; };
  const f = (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    const i = seg(x);
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
  f.speed = (x) => {
    if (x <= xs[0] || x >= xs[n - 1]) return 0;
    const i = seg(x);
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    return ((6 * t2 - 6 * t) * ys[i] + (3 * t2 - 4 * t + 1) * h * m[i] + (-6 * t2 + 6 * t) * ys[i + 1] + (3 * t2 - 2 * t) * h * m[i + 1]) / h;
  };
  return f;
}
