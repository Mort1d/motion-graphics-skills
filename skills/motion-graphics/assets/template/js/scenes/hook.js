// @template-demo — Hook (beats 0–8): a light line draws across the black, three words slam on beats 1-2-3 with shakes
// and flashes, the subline decodes, the camera pushes in, then a whip pan exits left into the next scene.
import { el, set, P, ease, clamp } from '../engine.js';
import { CUE, S, BEAT } from '../timeline.mjs';
import { TX } from '../i18n.js';
import { W, H, U, fitFont, slam, shakes, flash, whip, scramble, drawSpeedLines } from '../kit.js';

export async function build(ctx) {
  const root = el('div', 'scene', ctx.stage);
  const glow = el('div', 'abs', root);
  const G = 1500 * U;
  Object.assign(glow.style, { width: `${G}px`, height: `${G}px`, borderRadius: '50%',
    background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 35%, transparent) 0%, color-mix(in srgb, var(--accent) 8%, transparent) 38%, transparent 70%)' });
  const cam = el('div', 'layer', root);
  cam.style.transformOrigin = '50% 50%';

  // the words, stacked and centred; measured once (fonts are loaded before build)
  const size = 230 * U;
  const lineH = size * 0.95;
  const words = TX.hook.map((w, i) => {
    const d = el('div', `kin${i === TX.hook.length - 1 ? ' accent glow' : ''}`, cam, w);
    d.style.fontSize = `${size}px`;
    const wd = fitFont(d, W * 0.86);
    return { d, w: wd, h: d.offsetHeight };
  });
  const top = H / 2 - (lineH * words.length) / 2 - 30 * U;
  words.forEach((wd, i) => { wd.x = W / 2 - wd.w / 2; wd.y = top + i * lineH; wd.d.style.transformOrigin = '50% 60%'; });

  const line = el('div', 'abs', cam);
  Object.assign(line.style, { width: `${W * 0.7}px`, height: `${Math.max(2, 3 * U)}px`, background: 'var(--accent)',
    boxShadow: '0 0 18px color-mix(in srgb, var(--accent) 90%, transparent), 0 0 60px color-mix(in srgb, var(--accent) 60%, transparent)', transformOrigin: '50% 50%' });

  const sub = el('div', 'abs mono', cam);
  Object.assign(sub.style, { font: `600 ${34 * U}px/1 var(--mono)`, letterSpacing: '0.08em', color: 'var(--muted)', whiteSpace: 'pre' });
  sub.textContent = TX.sub;
  const subW = fitFont(sub, W * 0.86);

  const fl = el('div', 'flash', root);
  const hits = [CUE.w1, CUE.w2, CUE.w3];

  return (t) => {
    const on = t >= S.hook[0] && t <= S.hook[1];
    set(root, { vis: on });
    if (!on) return;

    // the light line: draws out across the centre, then bursts when the first word lands
    const lp = P(t, CUE.line, CUE.line + 0.45, ease.outExpo);
    const burst = P(t, CUE.w1, CUE.w1 + 0.16, ease.outCubic);
    set(line, { x: W * 0.15, y: H / 2, sx: lp, sy: 1 + burst * 6, o: t < CUE.line ? 0 : 1 - burst });

    // three slams on the beat; the stack re-centres as it grows, so the newest word lands near the middle
    let offY = ((words.length - 1) * lineH) / 2;
    for (let i = 1; i < words.length; i++) offY -= (lineH / 2) * ease.outCubic(clamp((t - hits[i]) / 0.3));
    words.forEach((wd, i) => {
      const s = slam(t, hits[i], { from: 1.7, dur: 0.24 });
      const sk = -12 * (1 - ease.outCubic(clamp((t - hits[i]) / 0.24)));
      set(wd.d, { x: wd.x, y: wd.y + offY, s: s.s, skx: sk, o: s.o });
    });

    // the subline decodes, typewriter-fast
    const sp = clamp((t - CUE.sub) / 0.7);
    sub.textContent = scramble(TX.sub, sp, t, 4);
    set(sub, { x: W / 2 - subW / 2, y: top + lineH * words.length + 50 * U + offY, o: t < CUE.sub ? 0 : Math.min(1, (t - CUE.sub) / 0.1) });

    // camera: shakes on the hits, a slow push, then the whip exit to the left
    const sh = shakes(t, hits, 16, 0.35);
    const push = 1 + 0.06 * P(t, CUE.w3 + 0.3, CUE.exit, ease.inOutSine);
    const wx = whip(t, CUE.exit, CUE.drop - CUE.exit, W * 1.3, 'out');
    set(cam, { x: sh.x + wx, y: sh.y, r: sh.r, s: push });

    // the glow breathes on every beat after the first hit
    const since = t >= CUE.w1 ? (t - CUE.w1) % BEAT : 9;
    set(glow, { x: W / 2 - G / 2 + wx * 0.5, y: H / 2 - G / 2, s: 1 + 0.05 * Math.exp(-since * 6), o: t < CUE.line ? 0 : 0.45 + 0.4 * Math.exp(-since * 5) });

    if (t >= CUE.exit && t < CUE.drop + 0.35) {
      drawSpeedLines(ctx.fx, t, { seed: 11, n: 70, dir: -1, alpha: 0.55 * (1 - P(t, CUE.drop, CUE.drop + 0.35)), speed: 7000 });
    }
    set(fl, { o: Math.max(...hits.map((h) => flash(t, h, 0.1, 0.14))) });
  };
}
