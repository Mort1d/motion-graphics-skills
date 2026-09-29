// Motion kit: the building blocks of the showreel look — slams, whips, shakes, flashes, counters, decode text,
// sparks, speed lines, shockwave rings, diagonal wipes. All pure functions of time; draw on ctx.fx for particles.
import { el, clamp, lerp, hash, noise1, ease, zoomLog } from './engine.js';
import { W, H } from './timeline.mjs';

export { W, H };
/** Layout unit: 1 at 1080 px on the short side — size things in U so 16:9, 9:16 and 1:1 all work. */
export const U = Math.min(W, H) / 1080;
export const VERTICAL = H > W;

/** A positioned text block; returns the element and its measured size (fonts are loaded before build). */
export function textBlock(parent, html, cls = 'kin', style = {}) {
  const e = el('div', cls, parent, html);
  Object.assign(e.style, style);
  return { el: e, w: e.offsetWidth, h: e.offsetHeight };
}

/** Shrinks an element's font until it is at most maxW px wide (no change when it fits). Returns the width. */
export function fitFont(e, maxW) {
  const w = e.offsetWidth;
  if (w > maxW) {
    const fs = parseFloat(e.style.fontSize || getComputedStyle(e).fontSize);
    e.style.fontSize = `${((fs * maxW) / w).toFixed(1)}px`;
  }
  return e.offsetWidth;
}

/** Letters of a string as inline-block spans (per-letter animation). Spaces keep their width. */
export function spans(parent, str, cls = 'ch') {
  parent.textContent = '';
  return [...str].map((c) => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = c === ' ' ? ' ' : c;
    parent.appendChild(s);
    return s;
  });
}

/** Camera shake after a kick at t0: decaying smooth noise → { x, y, r }. */
export function shake(t, t0, amp = 12, dur = 0.4, seed = 1) {
  const d = t - t0;
  if (d < 0 || d > dur) return { x: 0, y: 0, r: 0 };
  const k = Math.pow(1 - d / dur, 2) * amp * U;
  return { x: noise1(d * 38, seed) * k, y: noise1(d * 41, seed + 7) * k, r: noise1(d * 29, seed + 3) * k * 0.05 };
}
/** Sum of several shakes (one per hit time). */
export function shakes(t, kicks, amp = 12, dur = 0.4) {
  const o = { x: 0, y: 0, r: 0 };
  kicks.forEach((t0, i) => { const s = shake(t, t0, amp, dur, i + 1); o.x += s.x; o.y += s.y; o.r += s.r; });
  return o;
}

/** Slam: scale from `from` to 1 with an overshoot that rings out → { s, o }. The workhorse of kinetic type. */
export function slam(t, t0, { from = 1.7, dur = 0.24, overshoot = 0.06 } = {}) {
  const d = t - t0;
  if (d < 0) return { s: from, o: 0 };
  const p = clamp(d / dur);
  const s = p < 1 ? lerp(from, 1 - overshoot, ease.outCubic(p)) : 1 - overshoot * Math.exp(-(d - dur) * 18) * Math.cos((d - dur) * 30);
  return { s, o: clamp(d / 0.04) };
}

/**
 * Whip: offset (px) of a whip-pan move. dir 'in' lands at 0 from `dist` (fast out-expo); 'out' leaves from 0 to -dist
 * (in-expo). Pair with 16 blur samples (WHIPS) and speed lines — that is what sells the speed.
 */
export function whip(t, t0, dur, dist, dir = 'in') {
  const p = clamp((t - t0) / dur);
  return dir === 'in' ? dist * (1 - ease.outExpo(p)) : -dist * ease.inExpo(p);
}

/** A word rising out of a mask line (its parent has overflow: hidden): translateY in % of its height, 100 → 0. */
export const rise = (t, t0, dur = 0.35, e = ease.snap) => 100 * (1 - e(clamp((t - t0) / dur)));

/**
 * One camera over one container (transform-origin 0 0): keys [[t, [x, y, zoom]], ...] — the point of the content held
 * in the middle of the frame, and how close. It eases from key to key, one move at a time, the zoom in log space (a
 * cursor inside the container scales with it); a key repeated with a later time holds the shot. Before the first
 * key it sits on the first, after the last on the last. → { x, y, z, transform }; write `transform` every frame.
 */
export function camera(t, ks, e = ease.inOutCubic) {
  let i = ks.findIndex((k) => t < k[0]);
  if (i < 0) i = ks.length;
  const a = ks[Math.max(0, i - 1)][1];
  const b = ks[Math.min(ks.length - 1, i)][1];
  const p = i === 0 || i === ks.length ? 0 : e(clamp((t - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0])));
  const z = zoomLog(p, a[2], b[2]);
  const x = lerp(a[0], b[0], p);
  const y = lerp(a[1], b[1], p);
  return { x, y, z, transform: `translate(${W / 2 - x * z}px, ${H / 2 - y * z}px) scale(${z})` };
}

/** Flash intensity 0..max: instant on at t0, gone after dur (white or brand-colour overlay). */
export const flash = (t, t0, dur = 0.12, max = 0.5) => (t >= t0 && t < t0 + dur ? max * Math.pow(1 - (t - t0) / dur, 2) : 0);

/**
 * Rolls a number from `from` to `to` between t0 and t0 + dur; integers by default. Pass the frame's own time — the
 * render function's second argument over FPS, `roll(f / FPS, …)`: the motion-blur samples of one frame then all show
 * the same real value and only the movement blurs (with the sample time a frame blends two numbers into one that was
 * never on the way).
 */
export function roll(t, t0, dur, from, to, { decimals = 0, e = ease.outCubic } = {}) {
  const v = lerp(from, to, e(clamp((t - t0) / dur)));
  return decimals ? v.toFixed(decimals) : String(Math.round(v));
}

const GLYPHS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789#%&/+=<>';
/** Decode text: characters before p·n are final, the rest cycle through glyphs (30 changes per second). */
export function scramble(str, p, t, seed = 0, glyphs = GLYPHS) {
  const done = Math.floor(clamp(p) * str.length);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (i < done || c === ' ') out += c;
    else if (p > 0) out += glyphs[Math.floor(hash(i * 13.7 + Math.floor(t * 30), seed) * glyphs.length)];
    else out += ' ';
  }
  return out;
}

/** Diagonal wipe as a clip-path: p 0 → hidden … 1 → fully revealed, the edge at `deg` degrees from vertical. */
export function slashClip(p, deg = 20, reverse = false) {
  const k = Math.tan((deg * Math.PI) / 180) * H;
  const x = lerp(-k, W, clamp(p));
  return reverse
    ? `polygon(${x}px 0, ${W}px 0, ${W}px ${H}px, ${x + k}px ${H}px)`
    : `polygon(0 0, ${x + k}px 0, ${x}px ${H}px, 0 ${H}px)`;
}

/** An SVG shockwave ring element (animate with set(): s grows, o fades). */
export function ring(parent, r = 300, stroke = 10, color = 'var(--text)') {
  return el('div', 'abs', parent, `<svg width="${2 * r + 40}" height="${2 * r + 40}" viewBox="${-r - 20} ${-r - 20} ${2 * r + 40} ${2 * r + 40}"><circle r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"/></svg>`);
}

// ---- particles on the shared fx canvas (cleared every frame) ---------------------------------------------------------------
/**
 * Deterministic spark burst: `n` sparks born over [t0, t0 + spread] at origin(u) (u in 0..1), flying along `dir`
 * (radians) ± `cone`, speed v0..v1 px/s, gravity g px/s². ember (default): hot sparks that cool to red and add light;
 * ember: false keeps each particle's colour and paints normally — confetti; color: [r, g, b] or a list of them.
 */
export function makeSparks({ seed = 1, n = 120, t0 = 0, spread = 0.2, origin, dir = -Math.PI / 2, cone = 0.9, v0 = 500, v1 = 1500, g = 1900, life0 = 0.25, life1 = 0.75, color = [255, 200, 120], ember = true }) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = origin(hash(i, seed));
    const a = dir + (hash(i, seed + 1) - 0.5) * 2 * cone;
    const v = lerp(v0, v1, Math.pow(hash(i, seed + 2), 0.7)) * U;
    const c = Array.isArray(color[0]) ? color[Math.floor(hash(i, seed + 5) * color.length)] : color;
    list.push({ t: t0 + spread * hash(i, seed), x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: lerp(life0, life1, hash(i, seed + 3)), w: (1.2 + 2.2 * hash(i, seed + 4)) * U, c });
  }
  return { list, g: g * U, ember };
}
export function drawSparks(g, sp, t, alpha = 1) {
  g.save();
  g.globalCompositeOperation = sp.ember ? 'lighter' : 'source-over';
  g.lineCap = 'round';
  for (const s of sp.list) {
    const [cr, cg, cb] = s.c;
    const d = t - s.t;
    if (d < 0 || d > s.life) continue;
    const heat = 1 - d / s.life;
    const x = s.x + s.vx * d;
    const y = s.y + s.vy * d + 0.5 * sp.g * d * d;
    const vx = s.vx; const vy = s.vy + sp.g * d;
    g.strokeStyle = sp.ember
      ? `rgba(${cr},${Math.round(cg * (0.4 + 0.6 * heat))},${Math.round(cb * heat * heat)},${(alpha * Math.pow(heat, 0.6)).toFixed(3)})`
      : `rgba(${cr},${cg},${cb},${(alpha * Math.min(1, heat * 3)).toFixed(3)})`;
    g.lineWidth = sp.ember ? s.w * (0.5 + heat * 0.8) : s.w * 1.6;
    g.beginPath();
    g.moveTo(x - vx * 0.026, y - vy * 0.026);
    g.lineTo(x, y);
    g.stroke();
  }
  g.restore();
}

/**
 * Speed lines: streaks across the frame (dir 1 = left→right, -1 = right→left; vertical: true for up/down).
 * blend 'lighter' (default) adds light — right on a dark ground; on a light ground pass
 * { blend: 'source-over', color: '22,19,27' } so the streaks paint dark.
 */
export function drawSpeedLines(g, t, { seed = 5, n = 60, speed = 5200, len0 = 200, len1 = 900, alpha = 0.5, color = '255,255,255', dir = 1, vertical = false, blend = 'lighter' } = {}) {
  g.save();
  g.globalCompositeOperation = blend;
  const span = vertical ? H : W;
  const across = vertical ? W : H;
  for (let i = 0; i < n; i++) {
    const c = lerp(0, across, hash(i, seed));
    const len = lerp(len0, len1, hash(i, seed + 1)) * U;
    const sp = speed * U * lerp(0.6, 1.4, hash(i, seed + 2));
    const period = (span + len * 2) / sp;
    const ph = (((t + hash(i, seed + 3) * period) % period) + period) % period / period;
    const p = dir > 0 ? -len + ph * (span + len * 2) : span + len - ph * (span + len * 2);
    const a = alpha * lerp(0.25, 1, hash(i, seed + 4));
    const th = lerp(1, 3.2, hash(i, seed + 5)) * U;
    const gr = vertical ? g.createLinearGradient(0, p - len * dir, 0, p) : g.createLinearGradient(p - len * dir, 0, p, 0);
    gr.addColorStop(0, `rgba(${color},0)`);
    gr.addColorStop(1, `rgba(${color},${a.toFixed(3)})`);
    g.fillStyle = gr;
    if (vertical) g.fillRect(c - th / 2, Math.min(p, p - len * dir), th, len);
    else g.fillRect(Math.min(p, p - len * dir), c - th / 2, len, th);
  }
  g.restore();
}

export const within = (t, a, z) => t >= a && t < z;
