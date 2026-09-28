// @template-demo — Proof (beats 8–16): the drop. Three glass cards whip in on the beat with speed lines, their numbers
// roll (the score ticks along with the digits); two statement lines slam; a beat of silence pushes in; whip up.
import { el, set, P, ease, clamp, lerp } from '../engine.js';
import { CUE, S, b } from '../timeline.mjs';
import { TX } from '../i18n.js';
import { W, H, U, VERTICAL, fitFont, slam, shakes, whip, roll, drawSpeedLines } from '../kit.js';

export async function build(ctx) {
  const root = el('div', 'scene', ctx.stage);
  root.style.zIndex = '2';
  const grid = el('div', 'layer', root);
  const step = 120 * U;
  grid.style.backgroundImage = `linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)`;
  grid.style.backgroundSize = `${step}px ${step}px`;
  grid.style.opacity = '0.35';
  const cam = el('div', 'layer', root);

  // cards: a row in landscape, a column in portrait
  const n = TX.cards.length;
  const cw = VERTICAL ? W * 0.8 : 500 * U;
  const ch = VERTICAL ? 300 * U : 330 * U;
  const gap = 44 * U;
  const total = VERTICAL ? n * ch + (n - 1) * gap : n * cw + (n - 1) * gap;
  const at = [CUE.drop, CUE.card2, CUE.card3];
  const cards = TX.cards.map((c, i) => {
    const d = el('div', 'card', cam);
    Object.assign(d.style, { width: `${cw}px`, height: `${ch}px` });
    const num = el('div', 'abs', d);
    Object.assign(num.style, { font: `900 ${150 * U}px/1 var(--display)`, letterSpacing: '-0.03em' });
    const unit = el('div', 'abs mono accent', d, c.unit);
    Object.assign(unit.style, { font: `700 ${32 * U}px/1 var(--mono)`, letterSpacing: '0.06em' });
    const label = el('div', 'abs', d, c.label);
    Object.assign(label.style, { font: `700 ${30 * U}px/1.15 var(--display)`, color: 'var(--muted)', width: `${cw - 88 * U}px` });
    const x = VERTICAL ? (W - cw) / 2 : (W - total) / 2 + i * (cw + gap);
    const y = VERTICAL ? (H - total) / 2 + i * (ch + gap) : (H - ch) / 2 - 40 * U;
    return { d, num, unit, label, x, y, t0: at[i] ?? CUE.card3 + b(i - 2), c };
  });

  const lines = TX.statement.map((s, i) => {
    const d = el('div', `kin${i ? ' accent glow' : ''}`, cam, s);
    d.style.fontSize = `${(VERTICAL ? 130 : 170) * U}px`;
    return { d, w: fitFont(d, W * 0.9), h: d.offsetHeight, t0: CUE.statement + b(i) };
  });

  return (t) => {
    const on = t >= S.proof[0] && t <= S.proof[1];
    set(root, { vis: on });
    if (!on) return;
    set(grid, { x: -((t * 40 * U) % step), y: -((t * 25 * U) % step), o: 0.35 });

    // the cards dim back when the statement takes over
    const back = P(t, CUE.statement - 0.05, CUE.statement + 0.3, ease.outCubic);
    cards.forEach((c, i) => {
      const d = t - c.t0;
      const wx = whip(t, c.t0, 0.42, W * 0.9, 'in');
      const r = lerp(8, 0, ease.outExpo(clamp(d / 0.42)));
      set(c.d, { x: c.x + wx, y: c.y + back * 30 * U, r, s: 1 - 0.08 * back, o: d < 0 ? 0 : 1 - 0.8 * back, blur: back * 6 * U });
      c.num.textContent = roll(t, c.t0 + 0.12, 0.8, c.c.from, c.c.to);
      const nw = c.num.offsetWidth;
      set(c.num, { x: 44 * U, y: 38 * U, o: 1 });
      set(c.unit, { x: 44 * U + nw + 16 * U, y: 38 * U + 150 * U * 0.62, o: 1 });
      set(c.label, { x: 44 * U, y: ch - 44 * U - 36 * U, o: 1 });
      if (d > -0.05 && d < 0.35 && i < 3) drawSpeedLines(ctx.fx, t, { seed: 20 + i, n: 36, dir: -1, alpha: 0.4 * (1 - d / 0.35), speed: 6400 });
    });

    // two statement lines slam; a beat of silence pushes in; then everything whips up out of frame
    const hole = P(t, CUE.hole, CUE.logo - 0.4, ease.inOutSine);
    lines.forEach((l, i) => {
      const s = slam(t, l.t0, { from: 1.6 });
      const y0 = H / 2 - (lines.length * l.h) / 2 + i * l.h;
      set(l.d, { x: W / 2 - l.w / 2, y: y0, s: s.s * (1 + 0.12 * hole), o: t < l.t0 ? 0 : s.o });
    });
    const wy = whip(t, CUE.logo - 0.4, 0.42, H * 1.25, 'out');
    const sh = shakes(t, [CUE.drop, CUE.card2, CUE.card3, ...lines.map((l) => l.t0)], 12, 0.3);
    set(cam, { x: sh.x, y: sh.y + wy, r: sh.r });
    if (t > CUE.logo - 0.45 && t < CUE.logo + 0.1) drawSpeedLines(ctx.fx, t, { seed: 31, n: 60, dir: -1, vertical: true, alpha: 0.5, speed: 8000 });
  };
}
