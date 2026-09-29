// Deterministic animation toolkit: everything is a pure function of time t (seconds). No CSS animations, no
// transitions, no Date.now(), no Math.random() — the capture renders any frame in any order, so a frame may depend
// only on t. Use rng(seed) / hash() / noise1() for randomness.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const mix = (a, b, p) => (Array.isArray(a) ? a.map((x, i) => lerp(x, b[i], p)) : lerp(a, b, p));
export const smooth = (x) => x * x * (3 - 2 * x);

const pow = Math.pow;
export const ease = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - pow(-2 * x + 2, 2) / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2),
  inQuart: (x) => x * x * x * x,
  outQuart: (x) => 1 - pow(1 - x, 4),
  inOutQuart: (x) => (x < 0.5 ? 8 * pow(x, 4) : 1 - pow(-2 * x + 2, 4) / 2),
  inQuint: (x) => pow(x, 5),
  outQuint: (x) => 1 - pow(1 - x, 5),
  inOutQuint: (x) => (x < 0.5 ? 16 * pow(x, 5) : 1 - pow(-2 * x + 2, 5) / 2),
  inExpo: (x) => (x <= 0 ? 0 : pow(2, 10 * x - 10)),
  outExpo: (x) => (x >= 1 ? 1 : 1 - pow(2, -10 * x)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? pow(2, 20 * x - 10) / 2 : (2 - pow(2, -20 * x + 10)) / 2),
  inSine: (x) => 1 - Math.cos((x * Math.PI) / 2),
  outSine: (x) => Math.sin((x * Math.PI) / 2),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outCirc: (x) => Math.sqrt(1 - pow(x - 1, 2)),
  inOutCirc: (x) => (x < 0.5 ? (1 - Math.sqrt(1 - pow(2 * x, 2))) / 2 : (Math.sqrt(1 - pow(-2 * x + 2, 2)) + 1) / 2),
  outBack: (x) => { const s = 1.70158; return 1 + (s + 1) * pow(x - 1, 3) + s * pow(x - 1, 2); },
  outBackSoft: (x) => { const s = 1.1; return 1 + (s + 1) * pow(x - 1, 3) + s * pow(x - 1, 2); },
  outBackHard: (x) => { const s = 2.6; return 1 + (s + 1) * pow(x - 1, 3) + s * pow(x - 1, 2); },
  inBack: (x) => { const s = 1.70158; return (s + 1) * x * x * x - s * x * x; },
};

/** CSS-style cubic-bezier easing. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(u) - x;
      if (Math.abs(e) < 1e-6) break;
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    u = clamp(u);
    return sy(u);
  };
}
// Signature curves: a fast-out "snap" and a smooth "glide".
ease.snap = bezier(0.16, 1, 0.3, 1);
ease.glide = bezier(0.65, 0, 0.35, 1);
ease.swift = bezier(0.7, 0, 0.2, 1);
ease.anticip = bezier(0.36, 0, 0.66, -0.56);

/** 0..1 progress of t through [t0, t1] with an easing. */
export const P = (t, t0, t1, e = ease.linear) => e(clamp((t - t0) / (t1 - t0)));

/** Damped spring step response 0 → 1 (overshoots when damping < 1). dt = seconds since the trigger. */
export function spring(dt, freq = 3, damping = 0.5) {
  if (dt <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const z = damping;
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + ((z * w) / wd) * Math.sin(wd * dt));
  }
  return 1 - Math.exp(-w * dt) * (1 + w * dt);
}

/**
 * Spring feels, as [freq, damping] for spring() and track(): snap — buttons, toggles, the leading edge of a moving
 * indicator (overshoots ~3 %); base — cards, containers, the camera (a hair, <1 %); heavy — big type, 3D objects, the
 * logo (none); play — mascots and stickers (a visible 25 % bounce). Type never bounces: heavy or base.
 */
export const SPRING = { snap: [5, 0.75], base: [3, 0.85], heavy: [2, 1], play: [3.5, 0.4] };

/**
 * A value that changes target several times, springing to each: keys [[t, value], ...] sorted by time (values are
 * numbers or arrays). One spring per change, summed — the motion stays continuous when a new target arrives mid-move,
 * and any frame is computed directly (frame 812 without simulating 0–811). feel = [freq, damping], e.g. SPRING.snap.
 */
export function track(t, ks, [freq, damping] = SPRING.base) {
  let v = ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    const s = spring(t - ks[i][0], freq, damping);
    if (s === 0) break;
    v = Array.isArray(v) ? v.map((x, j) => x + (ks[i][1][j] - ks[i - 1][1][j]) * s) : v + (ks[i][1] - ks[i - 1][1]) * s;
  }
  return v;
}

/** Zoom between two scales at progress p in log space: 1× → 2× takes as long as 2× → 4×, so a push never lurches. */
export const zoomLog = (p, z0, z1) => z0 * Math.pow(z1 / z0, p);

/** Damped oscillation around 0 that starts at 0: a "wobble" kick (squash/stretch, jiggle). */
export function wobble(dt, freq = 4, damping = 0.35) {
  if (dt <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const wd = w * Math.sqrt(1 - damping * damping);
  return Math.exp(-damping * w * dt) * Math.sin(wd * dt);
}

/** Keyframes: [[t, value, easeIntoThisKey?], ...]; values may be numbers or arrays. */
export function keys(t, ks) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    const k = ks[i];
    if (t <= k[0]) {
      const a = ks[i - 1];
      const p = (k[2] || ease.inOutCubic)((t - a[0]) / (k[0] - a[0]));
      return mix(a[1], k[1], p);
    }
  }
  return ks[ks.length - 1][1];
}

/** Seeded PRNG (mulberry32). */
export function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D value noise, deterministic. */
export function noise1(x, seed = 0) {
  const h = (n) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x);
  const f = x - i;
  return lerp(h(i), h(i + 1), smooth(f)) * 2 - 1;
}

// ---- DOM ----------------------------------------------------------------------------------------
export function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export function svgEl(markup, parent) {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  const node = tpl.content.firstChild;
  if (parent) parent.appendChild(node);
  return node;
}

const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * Writes an element's whole transform and opacity from a props bag — a full state write, not a patch:
 *  · the transform is rebuilt from the props given (a missing x / s / r means 0 / 1 / 0), so pass x, y and s together;
 *  · opacity falls back to the CSS value when `o` is missing — pass `o` every frame for anything you fade;
 *  · o: 0 hides with visibility (the element keeps its layout box); `vis: false` removes it (display: none) and it stays
 *    removed until a later call passes `vis: true`.
 * Transform order: translate → rotate(X,Y,Z) → skew → scale. Keys: x y z (px) · r rx ry (deg) · s sx sy · skx sky (deg)
 * · o (opacity) · blur (px) · vis (bool) · origin.
 */
// set() twice on one element in one frame is always a bug: the second call replaces the first one's whole transform
// and opacity. main.js counts frames; the first repeat per element is reported once (capture prints it as [page]).
let frameNo = 0;
const lastSet = new WeakMap();
const warned = new WeakSet();
export const nextFrame = () => { frameNo++; };
const describe = (e) => `<${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${typeof e.className === 'string' && e.className ? `.${e.className.trim().split(/\s+/).join('.')}` : ''}> "${(e.textContent || '').trim().slice(0, 24)}"`;

export function set(e, p) {
  // display is only touched through `vis`; layers hidden by their scene stay hidden
  if (p.vis === false) { if (e.style.display !== 'none') e.style.display = 'none'; return; }
  if (frameNo > 0) {
    if (lastSet.get(e) === frameNo && !warned.has(e)) {
      warned.add(e);
      console.warn(`set() called twice on ${describe(e)} in one frame: the second call replaces the first one's transform and opacity — merge them into one call`);
    }
    lastSet.set(e, frameNo);
  }
  if (p.vis === true && e.style.display === 'none') e.style.display = '';
  // Fully transparent → not painted, but keeps its box (rolling digits rely on the layout).
  const hidden = p.o === 0 ? 'hidden' : '';
  if (e.style.visibility !== hidden) e.style.visibility = hidden;
  let tr = '';
  if (p.x || p.y || p.z) tr += `translate3d(${r3(p.x || 0)}px,${r3(p.y || 0)}px,${r3(p.z || 0)}px) `;
  if (p.rx) tr += `rotateX(${r3(p.rx)}deg) `;
  if (p.ry) tr += `rotateY(${r3(p.ry)}deg) `;
  if (p.r) tr += `rotate(${r3(p.r)}deg) `;
  if (p.skx || p.sky) tr += `skew(${r3(p.skx || 0)}deg,${r3(p.sky || 0)}deg) `;
  const s = p.s ?? 1;
  const sx = (p.sx ?? 1) * s;
  const sy = (p.sy ?? 1) * s;
  if (sx !== 1 || sy !== 1) tr += `scale(${r3(sx)},${r3(sy)})`;
  e.style.transform = tr || 'none';
  e.style.opacity = p.o === undefined ? '' : String(r3(p.o));
  if (p.blur !== undefined) e.style.filter = p.blur > 0.05 ? `blur(${r3(p.blur)}px)` : 'none';
  if (p.origin) e.style.transformOrigin = p.origin;
}

export function show(e, on) {
  const d = on ? '' : 'none';
  if (e.style.display !== d) e.style.display = d;
}

// ---- extras ------------------------------------------------------------------------------------------

/**
 * CSS @keyframes replayed as a pure function of time: frames = [[pct, {prop: value}, ease?], ...],
 * where `ease` (a function) is the timing function from that key to the next one, like
 * `animation-timing-function` inside a CSS keyframe. Missing props hold their last value.
 */
export function cssKeys(t, period, frames, offset = 0) {
  const p = ((((t + offset) % period) + period) % period) / period * 100;
  let i = 0;
  while (i < frames.length - 1 && frames[i + 1][0] <= p) i++;
  const a = frames[i];
  const z = frames[Math.min(i + 1, frames.length - 1)];
  if (a === z || z[0] === a[0]) return { ...a[1] };
  const k = (a[2] || ease.inOutSine)((p - a[0]) / (z[0] - a[0]));
  const out = {};
  for (const key of new Set([...Object.keys(a[1]), ...Object.keys(z[1])])) {
    const d = key === 's' || key === 'sx' || key === 'sy' || key === 'v' ? 1 : 0; // identity for scales
    const va = a[1][key] ?? d;
    const vz = z[1][key] ?? d;
    out[key] = va + (vz - va) * k;
  }
  return out;
}

/** step-end keyframes (blinks): windows = [[pctOn, pctOff], ...] → true while inside one. */
export function stepOn(t, period, windows, offset = 0) {
  const p = ((((t + offset) % period) + period) % period) / period * 100;
  return windows.some(([a, z]) => p >= a && p < z);
}

/** Rounded rectangle whose corners are pixel staircases (w, h, corner radius r, step s). */
export function pixelRectPath(w, h, r, s) {
  const n = Math.max(1, Math.round(r / s));
  const steps = [];
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) / n;
    const inset = r * (1 - Math.sqrt(1 - (1 - y) * (1 - y)));
    steps.push(Math.round(inset / s) * s);
  }
  const rs = n * s;
  let d = `M${steps[0]} 0H${w - steps[0]}`;
  for (let i = 1; i < n; i++) d += `V${i * s}H${w - steps[i]}`;
  d += `V${rs}H${w}V${h - rs}`;
  for (let i = n - 1; i >= 1; i--) d += `H${w - steps[i]}V${h - i * s}`;
  d += `H${w - steps[0]}V${h}H${steps[0]}`;
  for (let i = 1; i < n; i++) d += `V${h - i * s}H${steps[i]}`;
  d += `V${h - rs}H0V${rs}`;
  for (let i = n - 1; i >= 1; i--) d += `H${steps[i]}V${i * s}`;
  d += `H${steps[0]}Z`;
  return d;
}

/** Pixel matrix (array of strings, '#' = on) → SVG path of unit squares scaled by `px`, offset (ox, oy). */
export function matrixPath(rows, px, ox = 0, oy = 0) {
  let d = '';
  rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (row[c] !== '#') { c++; continue; }
      let e = c;
      while (e < row.length && row[e] === '#') e++;
      d += `M${ox + c * px} ${oy + r * px}h${(e - c) * px}v${px}h${-(e - c) * px}z`;
      c = e;
    }
  });
  return d;
}

/** Splits text into per-character spans inside `parent`; spaces keep their width. */
export function splitChars(parent, text, cls = 'ch') {
  parent.textContent = '';
  return [...text].map((c) => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = c === ' ' ? ' ' : c;
    parent.appendChild(s);
    return s;
  });
}

/** Deterministic hash → [0, 1). */
export function hash(n, seed = 0) {
  const s = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Beat-synced squash on landing: returns {sx, sy} for a kick at dt seconds ago. */
export function squash(dt, amount = 0.18, freq = 5, damping = 0.32) {
  const w = wobble(dt, freq, damping) * amount;
  return { sx: 1 + w, sy: 1 - w };
}

/** Linear-in-time value clamp helper for windows: is t inside [a, z)? */
export const within = (t, a, z) => t >= a && t < z;
