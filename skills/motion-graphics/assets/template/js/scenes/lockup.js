// @template-demo — Lockup (beat 16 → end): the wordmark slams with a shockwave and sparks, the tagline rises, the call
// to action slides in, the contacts pop one by one; a last hit on beat 22, then the frame holds with a slow push.
// Replace the text wordmark with the brand's traced SVG logo (scripts/trace-logo.mjs) in real projects.
import { el, set, P, ease, clamp, lerp } from '../engine.js';
import { CUE, S, DURATION, b } from '../timeline.mjs';
import { BRAND } from '../copy.mjs';
import { TX } from '../i18n.js';
import { W, H, U, VERTICAL, fitFont, slam, shake, flash, ring, makeSparks, drawSparks } from '../kit.js';

const ICONS = {
  phone: '<path d="M7 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 5 5a2 2 0 0 1 2-2z" fill="#fff"/>',
  send: '<path d="M3 11.5L21 4l-5 17-4-7-9-2.5z" fill="#fff"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
};

export async function build(ctx) {
  const root = el('div', 'scene', ctx.stage);
  root.style.zIndex = '3';
  const bg = el('div', 'layer', root);
  bg.style.background = 'radial-gradient(ellipse 60% 55% at 50% 42%, color-mix(in srgb, var(--accent) 10%, var(--bg)) 0%, var(--bg) 70%)';
  const lock = el('div', 'layer', root);
  lock.style.transformOrigin = '50% 45%';

  const mark = el('div', 'kin', lock, BRAND);
  mark.style.fontSize = `${(VERTICAL ? 250 : 320) * U}px`;
  const mw = fitFont(mark, W * 0.8);
  const mh = mark.offsetHeight;
  const my = H * (VERTICAL ? 0.34 : 0.3);
  mark.style.transformOrigin = '50% 55%';
  const bar = el('div', 'abs', lock);
  Object.assign(bar.style, { width: `${mw * 0.62}px`, height: `${8 * U}px`, background: 'var(--accent)', borderRadius: `${4 * U}px`, transformOrigin: '0 50%',
    boxShadow: '0 0 24px color-mix(in srgb, var(--accent) 80%, transparent)' });
  const R = 300 * U;
  const shock = ring(lock, R, 10 * U, 'var(--text)');
  const shock2 = ring(lock, R, 6 * U, 'var(--accent)');

  const tag = el('div', 'abs caps', lock, TX.tagline);
  tag.style.fontSize = `${28 * U}px`;
  tag.style.color = 'var(--muted)';
  const tagW = fitFont(tag, W * 0.86);
  const cta = el('div', 'abs', lock, TX.cta);
  Object.assign(cta.style, { font: `italic 900 ${60 * U}px/1 var(--display)`, whiteSpace: 'nowrap' });
  const ctaW = fitFont(cta, W * 0.86);
  const pills = TX.contacts.map((c) => {
    const s = 26 * U;
    const d = el('div', 'pill', lock, `<i style="width:${54 * U}px;height:${54 * U}px"><svg width="${s}" height="${s}" viewBox="0 0 24 24">${ICONS[c.icon] || ''}</svg></i><span>${c.text}</span>`);
    Object.assign(d.style, { height: `${78 * U}px`, padding: `0 ${30 * U}px 0 ${12 * U}px`, font: `700 ${32 * U}px/1 var(--display)` });
    return { d, w: d.offsetWidth, h: d.offsetHeight };
  });
  // contacts: one row in landscape, a column in portrait
  const gap = 22 * U;
  const rowW = pills.reduce((s, p) => s + p.w, 0) + gap * (pills.length - 1);
  let px = W / 2 - rowW / 2;
  const baseY = VERTICAL ? H * 0.64 : H * 0.8;
  pills.forEach((p, i) => {
    if (VERTICAL) { p.x = W / 2 - p.w / 2; p.y = baseY + i * (p.h + gap); } else { p.x = px; p.y = baseY; px += p.w + gap; }
  });
  const sparks = makeSparks({ seed: 7, n: 160, t0: CUE.logo + 0.02, spread: 0.12, dir: -Math.PI / 2, cone: 1.1, v0: 400, v1: 1500,
    origin: (u) => [W / 2 - mw / 2 + mw * u, my + mh * 0.82], color: [255, 170, 110] });
  const fl = el('div', 'flash', root);

  return (t) => {
    const on = t >= S.lockup[0] && t <= DURATION + 0.1;
    set(root, { vis: on });
    if (!on) return;
    const L = t - CUE.logo;
    // the backdrop fades in over the overlap of the two windows: fully in when the previous scene's window ends —
    // earlier it covers that scene's exit, later it leaves flat frames between them (QA: flash)
    set(bg, { o: P(t, S.lockup[0], S.proof[1]) });
    const sm = slam(t, CUE.logo, { from: 2.2, dur: 0.3, overshoot: 0.05 });
    const pulse = t > CUE.final ? 1 + 0.03 * Math.exp(-(t - CUE.final) * 7) : 1;
    set(mark, { x: W / 2 - mw / 2, y: my, s: sm.s * pulse, o: sm.o });
    set(bar, { x: W / 2 - (mw * 0.62) / 2, y: my + mh + 18 * U, sx: P(t, CUE.logo + 0.2, CUE.logo + 0.7, ease.outExpo), o: L > 0.2 ? 1 : 0 });
    const rp = clamp(L / 0.65);
    set(shock, { x: W / 2 - R - 20, y: my + mh / 2 - R - 20, s: 0.25 + rp * 2.6, o: L < 0 ? 0 : (1 - rp) * 0.55 });
    const fp = clamp((t - CUE.final) / 0.6);
    set(shock2, { x: W / 2 - R - 20, y: my + mh / 2 - R - 20, s: 0.4 + fp * 2.2, o: t < CUE.final ? 0 : (1 - fp) * 0.6 });
    if (L > 0 && L < 1.4) drawSparks(ctx.fx, sparks, t, 1);

    const tp = ease.outCubic(clamp((t - CUE.tagline) / 0.45));
    set(tag, { x: W / 2 - tagW / 2, y: my + mh + 60 * U + lerp(24 * U, 0, tp), o: tp });
    const cp = ease.outExpo(clamp((t - CUE.cta) / 0.4));
    set(cta, { x: W / 2 - ctaW / 2 + lerp(-90 * U, 0, cp), y: baseY - 120 * U, o: clamp((t - CUE.cta) / 0.06) });
    pills.forEach((p, i) => {
      const d = t - (CUE.cta + b(0.5) * (i + 1));
      const pp = ease.outBackSoft(clamp(d / 0.35));
      set(p.d, { x: p.x, y: p.y + lerp(40 * U, 0, pp), s: lerp(0.85, 1, pp), o: clamp(d / 0.08) });
    });

    const sh = shake(t, CUE.logo, 22, 0.5, 40);
    const sh2 = shake(t, CUE.final, 12, 0.4, 41);
    const push = 1 + 0.025 * P(t, CUE.cta, DURATION, ease.inOutSine);
    set(lock, { x: sh.x + sh2.x, y: sh.y + sh2.y, s: push, o: 1 });
    set(fl, { o: Math.max(flash(t, CUE.logo, 0.12, 0.45), flash(t, CUE.final, 0.1, 0.25)) });
  };
}
