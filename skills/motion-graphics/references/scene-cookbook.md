# Scene cookbook

Code patterns for the scenes, using the template's `js/engine.js` (`el`, `set`, `P`, `ease`, `clamp`, `lerp`, `keys`,
`spring`, `SPRING`, `track`, `zoomLog`, `hash`, `noise1`, `rng`) and `js/kit.js` (`U`, `VERTICAL`, `W`, `H`, `fitFont`,
`spans`, `slam`, `whip`, `shake(s)`, `flash`, `roll`, `rise`, `camera`, `scramble`, `slashClip`, `ring`, `makeSparks` /
`drawSparks`, `drawSpeedLines`).
Adapt them — they are idioms, not finished scenes. The person's own footage and photos on the WebGL screen (speed
ramps, whips that carry the camera, grades, a screen recording zoomed to the work) live in `footage.md`.

## Contents
1. Scene skeleton and the frame contract
2. Kinetic type: a word per beat
3. Per-letter reveal
4. Decode text
5. Rolling numbers
6. Typing, shared with the score
7. Glass card / UI panel with a cursor
8. Phone mockup with a scrolling feed
9. 3D photo wall from the client's photos
10. Map with routes drawing
11. Traced logo: letters, cut, sparks
12. Logo drawing on (stroke → fill)
13. Brand-angle wipe
14. Zoom-through
15. 2×2 grid of mini scenes
16. Particles, speed lines, light streaks
17. Split-flap board
18. Charts and progress
19. The lockup (CTA + contacts)
20. Images, performance, sharing data with the score
21. Split and open: a shape cracks into two halves
22. One shape, never cut: a morphing container
23. The smart-camera screen demo
24. Words rising out of a mask line
25. The proof number
26. The loop end card
27. Construction wipe
28. Rack focus

## 1. Scene skeleton and the frame contract

```js
import { el, set, P, ease, clamp } from '../engine.js';
import { CUE, S, b } from '../timeline.mjs';
import { TX } from '../i18n.js';
import { W, H, U, fitFont, slam } from '../kit.js';

export async function build(ctx) {             // runs once: build DOM, measure text (fonts are loaded)
  const root = el('div', 'scene', ctx.stage);
  root.style.zIndex = '4';                      // later scenes above earlier ones
  const title = el('div', 'kin', root, TX.offer);
  title.style.fontSize = `${180 * U}px`;
  const tw = fitFont(title, W * 0.88);
  return (t, f) => {                            // runs every frame: a pure function of t (f = the frame number)
    const on = t >= S.offer[0] && t <= S.offer[1];
    set(root, { vis: on });
    if (!on) return;
    const s = slam(t, CUE.offer);
    set(title, { x: W / 2 - tw / 2, y: H * 0.4, s: s.s, o: s.o });
  };
}
```

The contract: a frame depends only on `t` — no CSS animations or transitions, no `Date`, `Math.random`, timers,
`<video>`; text that changes (a rolling number, decoding letters, typing) is computed from the frame's own time
`f / FPS`, so the motion-blur samples of one frame all show the same characters and only the movement blurs; every animated property is written every frame (`set()` rewrites the whole transform and opacity; pass `o`
for anything you ever fade); a scene hides itself outside its window; an early-starting scene must not cover the
previous one with an opaque background (fade its backdrop in with its first element).

Two traps of `set()` that look right in code: a second `set()` on the same element in the same frame wipes the first
(the page warns once: `[page] set() called twice on …`) — build one call; and a position set once in `build()` is
wiped by the first frame's `set()` without `x`/`y` — pass the position every frame, or place the element with CSS
`left` / `top` and animate only the rest. Within a scene, later-created elements paint on top; give layers an
explicit `zIndex` (background, hero, foreground accents) instead of relying on the order of `el()` calls.

## 2. Kinetic type: a word per beat

```js
const words = TX.claim.map((w, i) => {
  const d = el('div', `kin${i === TX.claim.length - 1 ? ' accent glow' : ''}`, root, w);
  d.style.fontSize = `${220 * U}px`;
  return { d, w: fitFont(d, W * 0.86), t0: CUE.claim + b(i) };
});
// frame:
words.forEach((wd, i) => {
  const s = slam(t, wd.t0, { from: 1.7, dur: 0.24 });
  set(wd.d, { x: W / 2 - wd.w / 2, y: H / 2 - 100 * U + (i - 1) * 205 * U, s: s.s, skx: -10 * (1 - clamp((t - wd.t0) / 0.24)), o: s.o });
});
```
Pair with `shakes(t, words.map((w) => w.t0), 14, 0.35)` on the camera layer and an `impact` per word in the score.

Lines under or through text (underlines, strokes that draw, strikethroughs) go from the measured box
(`getBoundingClientRect()` after fonts load), never from the font size: descenders (g j p q y, and their
kin in other scripts) hang below the baseline, and an underline placed for capitals cuts through them. Check a still.

## 3. Per-letter reveal

```js
const line = el('div', 'kin', root);
const chars = spans(line, TX.brand);            // inline-block spans
// frame: each letter 1/16 beat after the previous, rising from below a mask
chars.forEach((c, i) => {
  const p = ease.outExpo(clamp((t - (CUE.logo + i * b(0.25))) / 0.4));
  set(c, { y: lerp(120 * U, 0, p), o: p > 0 ? 1 : 0 });
});
line.style.clipPath = 'inset(0 -20% 0 -20%)';  // hides letters below the baseline box
```

## 4. Decode text

```js
node.textContent = scramble(TX.vin, clamp((t - CUE.decode) / 0.8), t, 3);   // monospace font keeps the width fixed
```

## 5. Rolling numbers

```js
num.textContent = roll(f / FPS, CUE.stat, 0.9, 0, 1200).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');   // 1 200
```
In the score, place ticks where the digits change with the same easing (outCubic: `t0 + dur * (1 - Math.cbrt(1 - k / n))`).

## 6. Typing, shared with the score

Put the schedule in a `.mjs` file so the score imports the same times:

```js
// js/typing.mjs — plain ESM, no DOM: the picture prints letters, the score clicks keys
import { CUE, b } from './timeline.mjs';
export const typeTimes = (text, t0 = CUE.typing, step = b(0.125)) => [...text].map((_, i) => t0 + i * step);
```
Picture: `node.textContent = TX.query.slice(0, typeTimes(TX.query).filter((x) => x <= t).length)` + a caret that
blinks on beats. Score: `typeTimes(TX.query).forEach((t) => A.key(t, { vel: 0.5 }))`.

## 7. Glass card / UI panel with a cursor

```js
const card = el('div', 'card', root, `<div class="ui-title">${TX.panel}</div>`);
Object.assign(card.style, { width: `${720 * U}px`, height: `${440 * U}px`, backdropFilter: 'blur(18px)' });
const cursor = el('div', 'abs', root, '<svg width="40" height="40" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#fff" stroke="#000" stroke-width="1"/></svg>');
// frame: the cursor glides to the button, presses (scale 0.9 for 0.1 s), the button lights up
const k = keys(t, [[CUE.move, [1400, 900]], [CUE.move + 0.6, [980, 610], ease.inOutCubic]]);
const press = t > CUE.click && t < CUE.click + 0.1;
set(cursor, { x: k[0] * U, y: k[1] * U, s: press ? 0.9 : 1, o: 1 });
```
Score: `click(CUE.click)`; a `success` when the result appears.

## 8. Phone mockup with a scrolling feed

A rounded rectangle (radius ~12 % of its width) with a notch, `overflow: hidden`; inside, a tall column of UI blocks
moved by `y = -scroll(t)` where `scroll` is `keys()` with `ease.inOutCubic` stops on each beat. Real screenshots from
the client can be the blocks (crop them; blur personal data).

## 9. 3D photo wall from the client's photos

```js
const wall = el('div', 'layer', root);
wall.style.perspective = `${1600 * U}px`;
const tiles = photos.map((src, i) => { const im = el('img', 'abs', wall); im.src = src; im.style.width = `${300 * U}px`; return im; });
// frame: tiles fly in from depth one per 32nd note, then the wall rotates slowly
tiles.forEach((im, i) => {
  const p = ease.outExpo(clamp((t - (CUE.wall + i * b(0.125))) / 0.5));
  const col = i % 8; const row = Math.floor(i / 8);
  set(im, { x: (col - 3.5) * 320 * U + W / 2 - 150 * U, y: (row - 2) * 230 * U + H / 2 - 100 * U, z: lerp(-2000, 0, p), ry: lerp(35, 0, p), o: p > 0 ? 1 : 0 });
});
set(wall, { ry: -8 + 6 * P(t, CUE.wall, S.orders[1]), o: 1 });
```
Pre-scale photos with ffmpeg to about twice their on-screen size (`ffmpeg -i in.jpg -vf scale=640:-2 out.jpg`) — big
images slow every capture.

## 10. Map with routes drawing

SVG paths for routes; set `stroke-dasharray` to the path length (`path.getTotalLength()` at build) and animate
`stroke-dashoffset` from the length to 0; stops pop (scale 0 → 1, `outBack`) when the route reaches them (compute the
time from the length fraction). Do not draw borders or territory claims you cannot source.

## 11. Traced logo: letters, cut, sparks

`node <skill>/scripts/trace-logo.mjs logo.png --out assets/logo` → `assets/logo.json` with one shape per letter
(sorted left → right). Build one `<svg>` per shape (or one svg with a `<path>` each) and slam them one per 16th; for a
two-colour logo trace each colour (`--mode color --color #hex`) and layer them. A cut: a clip-path polygon at the
logo's own angle sweeping across, with `makeSparks` along its edge.

## 12. Logo drawing on (stroke → fill)

```js
// build: path.style.fill = 'transparent'; path.style.stroke = 'var(--text)'; const len = path.getTotalLength();
path.style.strokeDasharray = `${len}`;
// frame:
path.style.strokeDashoffset = String(len * (1 - P(t, CUE.logo, CUE.logo + 0.8, ease.inOutCubic)));
path.style.fillOpacity = String(P(t, CUE.logo + 0.7, CUE.logo + 1.0));
```

## 13. Brand-angle wipe

```js
nextScene.style.background = 'var(--bg)';   // a clip only hides: without a fill the old scene shows through the holes
nextScene.style.clipPath = slashClip(P(t, CUE.wipe, CUE.wipe + 0.35, ease.inOutSine), 24);   // the logo's angle
```
Add a solid accent band riding the edge (a rotated div following the same x) and a `whoosh` of the same length.
Without a wipe, an opaque backdrop of the incoming scene fades in over the overlap of the two windows —
`P(t, S.next[0], S.prev[1])` — never before the old scene starts leaving (it covers the exit) and never after it is
gone (flat frames).
Whatever glows or moves in the background of the new scene follows the wipe's progress, not the new scene's first
cue — otherwise the frames between the end of the wipe and the first slam are flat and dead (QA reports them as
`flash`; both traps are in pipeline.md §11).

## 14. Zoom-through

Scale the current scene around the centre of a letter's counter (the hole of an "O"), a dot or a screen: set
`transformOrigin` at that point, `s` from 1 to 30 with `ease.inExpo` over ~0.5 s; the next scene starts inside it at
`s` 0.6 → 1 (`outExpo`). A `whoosh` shape 'in' ending on the switch.

## 15. 2×2 grid of mini scenes

Four `.layer` cells (each `overflow: hidden`, a gap of 12–20 px, rounded corners); each runs its own mini animation from
the same `t` with an offset of a beat; the grid itself scales in from 1.1 and rotates 0 → -2°. Great for "four
features at once" or "four cases".

## 16. Particles, speed lines, light streaks

Draw on `ctx.fx` (cleared every frame, above all scenes):
```js
const sparks = makeSparks({ seed: 3, n: 180, t0: CUE.slash, spread: 0.3, origin: (u) => [x0 + u * len, y0], dir: -Math.PI / 3, cone: 0.8 });
if (t > CUE.slash && t < CUE.slash + 1.2) drawSparks(ctx.fx, sparks, t);
if (t > CUE.whip - 0.05 && t < CUE.whip + 0.4) drawSpeedLines(ctx.fx, t, { dir: -1, alpha: 0.5 });
```
Sparks glow and cool to red (light added on top). Confetti keeps its colours and paints normally — the right one on a
light background: `makeSparks({ …, ember: false, color: [[255, 90, 54], [255, 194, 75], [90, 160, 255]] })`.
A light streak: a long thin gradient div (transparent → white → transparent), `mix-blend-mode: screen`, sweeping
across with `ease.inOutCubic`, plus a `swish`.

## 17. Split-flap board

Keep the flip schedule (which character each cell shows, and when each flap falls) in a `.mjs` module; the scene draws
each cell as top / bottom halves and a flap rotating `rx` 0 → -90° (top) and 90° → 0 (bottom) over ~50 ms per flip;
the score imports the same schedule and plays one `tick` per flap (thinned to one per 10 ms bucket).

## 18. Charts and progress

Bars: width `lerp(0, value, ease.outCubic(p))` with staggered starts and the value rolling on top; lines: an SVG
polyline with the dashoffset draw-on; donuts: `stroke-dasharray` on a circle. Real data only.

## 19. The lockup (CTA + contacts)

The template's `lockup.js` is the pattern: the logo slams (+ ring, sparks, flash, shake, an `impact` + the sonic logo),
the tagline rises one beat later, the CTA slides in, contact pills pop one per half-beat with icons, the frame holds
with a slow push, a last hit on a downbeat. In portrait (`VERTICAL`) stack the pills.

## 20. Images, performance, sharing data with the score

- Preload images in `build` as `<img>` elements and toggle their visibility; never swap `img.src` during the render
  (an undecoded frame can get captured). `main.js` decodes every `<img>` before `__ready`.
- `object-fit: cover` for photos; `mix-blend-mode: multiply` to drop an off-white background from a raster logo.
- Prefer transforms and opacity; avoid animating `filter: blur()` on large layers every frame (slow) — use it on small
  elements or bake it into images; canvases for particles.
- An SVG `<clipPath>` must contain the shapes directly (a wrapping `<g>` clips everything away).
- Measure positions once in `build`, not per frame (layout inside transformed parents is unstable).
- Anything the score needs (word lists, schedules, curves) lives in `js/*.mjs` — plain ESM, no DOM — so Node can import
  it. Keep `copy.mjs` and `timeline.mjs` that way.

## 21. Split and open: a shape cracks into two halves

A bean cracks, a box opens, a logo splits along its own line: draw the shape twice, clip each copy to one side of the
line, and move the halves apart along the line's normal. Any SVG or HTML works — no path surgery.
```js
// build: two copies of the same mark, each clipped to one half-plane of the line through (x0, y0)–(x1, y1), in %
const halves = [0, 1].map(() => { const h = svgEl(markSvg, layer); h.classList.add('abs'); return h; }); // stacked, not in flow
halves[0].style.clipPath = 'polygon(0 0, 55% 0, 45% 100%, 0 100%)';      // left of the crack
halves[1].style.clipPath = 'polygon(55% 0, 100% 0, 100% 100%, 45% 100%)'; // right of the crack
// frame: apart along the normal of the crack, with a little rotation, sparks from the line (§16), a crack sound
const k = P(t, CUE.crack, CUE.crack + 0.35, ease.outExpo);
set(halves[0], { x: bx - 60 * k * U, y: by - 8 * k * U, r: -6 * k, o: 1 });
set(halves[1], { x: bx + 60 * k * U, y: by + 8 * k * U, r: 6 * k, o: 1 });
```
A curved crack: `clip-path: path('…')` with the same curve closing each side. Put what was inside (the wordmark, a
product) between the halves at a lower `zIndex`, so it is revealed as they part.

## 22. One shape, never cut: a morphing container

One element carries the whole scene: its box springs from state to state (a dot → a button → a card → a pill) while
its content swaps inside. If you can point at a moment where one thing disappears and another appears, it is a cut.

```js
const box = el('div', 'morph', root);           // CSS: position absolute; overflow hidden; background var(--surface)
const states = [                                // [cue, [x, y, w, h, radius]]
  [CUE.dot,    [W / 2 - 12 * U,  H / 2 - 12 * U,  24 * U,  24 * U,  12 * U]],
  [CUE.button, [W / 2 - 160 * U, H / 2 - 36 * U,  320 * U, 72 * U,  36 * U]],
  [CUE.card,   [W / 2 - 380 * U, H / 2 - 260 * U, 760 * U, 520 * U, 28 * U]],
  [CUE.pill,   [W / 2 - 120 * U, H / 2 - 30 * U,  240 * U, 60 * U,  30 * U]],
];
const faces = ['dot', 'button', 'card', 'pill'].map((n) => {  // real crops from ui-shot.mjs, transparent corners
  const im = el('img', 'abs', box); im.src = `assets/ui/${n}.png`; im.style.width = '100%'; return im;
});
// frame:
const [x, y, w, h, r] = track(t, states, SPRING.base);
Object.assign(box.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, borderRadius: `${r}px` });
faces.forEach((face, i) => {
  // a face enters once its morph has started and leaves before the next one: never two at full opacity
  const tIn = states[i][0] + 0.08;
  const tOut = (states[i + 1]?.[0] ?? Infinity) - 0.1;
  set(face, { o: Math.min(clamp((t - tIn) / 0.12), clamp((tOut - t) / 0.1)) });
});
```
- The box's size changes through width and height, not a scale: the content inside keeps its own size and sharpness.
- A colour change is a shape too: a circle grows from the cursor and floods the box, instead of a fade.
- A big shrink uses a firmer spring (`SPRING.snap`) so an overshoot never clips the content ("Sent" cut to "Sen").
- A cursor drives the changes: each state's cue is a click (§7), and the score clicks from the same cues.

## 23. The smart-camera screen demo

The real product on one large card; a cursor does real actions; one camera zooms to wherever the work happens.

```js
const cam = el('div', 'abs', root);             // everything the camera films, the cursor included
cam.style.transformOrigin = '0 0';
const ui = el('img', 'abs', cam); ui.src = 'assets/ui/dashboard.png';   // ui-shot at 2×, drawn at its CSS size
const cursor = el('div', 'abs', cam, CURSOR_SVG);
const moves = [[CUE.m1, [1200, 700]], [CUE.m2, [310, 420]], [CUE.m3, [880, 520]]];          // in the UI's pixels
// the camera moves in the beat before each action and holds while it happens (a key repeated = a hold)
const shots = [[CUE.m2 - b(1), [960, 540, 1]], [CUE.m2, [360, 420, 2.2]], [CUE.m3 - b(1), [360, 420, 2.2]],
  [CUE.m3, [880, 520, 2.6]], [CUE.out - b(1), [880, 520, 2.6]], [CUE.out, [960, 540, 1]]];
const clicks = [CUE.m2 + 0.35, CUE.m3 + 0.35];                                             // the cursor has landed
// frame:
cam.style.transform = camera(t, shots).transform;  // not set(cam): set() writes its own transform
const [cx, cy] = track(t, moves, SPRING.base);
const press = clicks.some((c) => t > c && t < c + 0.1);
set(cursor, { x: cx, y: cy, s: press ? 0.88 : 1, o: 1 });
```
- One move at a time: the camera arrives, the cursor acts, then the next move; zoom is in log space (`camera()`).
- The cursor lives inside the camera, so it scales with the zoom like a screen recording.
- The camera arrives a beat before the click; UI text in focus is at least 28 px on screen at 1080p — zoom until it is.
- Score: a click per press (the same `clicks`), a soft whoosh per camera move, a ding when the result appears.

## 24. Words rising out of a mask line

```js
const line = el('div', 'rise-line', root);      // CSS: display flex; gap .28em; line-height 1.05
const lineH = 190 * U;
const words = TX.hook.map((w, i) => {
  const mask = el('span', 'mask', line);        // CSS: display inline-block; overflow hidden; height = lineH
  return el('span', i === TX.hook.length - 1 ? 'kin accent-face' : 'kin', mask, w);
});
// frame: each word starts a little before its beat, so it has settled when the beat lands
words.forEach((s, i) => set(s, { y: (rise(t, CUE.hook + b(i) - 0.12) / 100) * lineH, o: 1 }));
```
- The accent word takes the contrasting face (a serif italic) or the accent colour; nothing fades in.
- A second line: the first slides up by a line height on a spring, the next rises under it.
- A stack of real rows can follow, one per beat, and squeeze into one dot that becomes the next scene (§22).

## 25. The proof number

```js
// real rows from brief.md; the total is their sum — checked here, not trusted
const rows = [{ amount: 3150 }, { amount: 2400 }, { amount: 1275 }, { amount: 850 }];
const total = rows.reduce((a, r) => a + r.amount, 0);
// frame: from the frame's own time, so a blurred frame never shows a number that was never on the way
const tf = f / FPS;
let v = total;
rows.forEach((r, i) => { v -= r.amount * ease.outCubic(clamp((tf - (CUE.rows + b(2 * i))) / 0.5)); });
num.textContent = fmtMoney(Math.max(0, Math.round(v)));   // Math.max: never "-0.00"
```
- The payoff value lands on the drop (the last row's cue + its settle = `CUE.drop`).
- No spring on a number: an overshoot would show a value that is not real.
- Score: a tick per change of the displayed value (from the same schedule), a coin or a chime on each row, the
  impact on the payoff.

## 26. The loop end card

X plays short videos in a loop; when the last frame is the first, the loop disappears and people watch twice.

```js
// js/timeline.mjs: export const LOOP = true;   (QA compares the first and the last frame; main.js wraps the
// motion-blur samples of frame 0 around the end, so the seam frame is blurred like any other)
const fold = P(t, DURATION - b(2), DURATION, ease.inOutCubic);   // the last two beats fold everything back
set(logo, { s: lerp(1, 0.2, fold), o: 1 - fold });
set(dot, { s: lerp(0.2, 1, fold), o: fold });                    // at DURATION: exactly frame 0's dot
```
- Everything ends where frame 0 starts: positions, scales, colours, the cursor's place and its speed.
- The score's last bar leads into its first (its tail becomes the pickup), or the loop jumps in the sound.

## 27. Construction wipe

A line sweeps across an element: behind it the finished thing, ahead of it the wireframe — the product built in front
of the viewer (a logo from its outline, a screen from its skeleton).

```js
const p = P(t, CUE.build, CUE.build + b(2), ease.inOutSine);
done.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`;   // the real crop, revealed left of the sweep
rough.style.clipPath = `inset(0 0 0 ${p * 100}%)`;         // outlines only, right of it
set(sweep, { x: x0 + p * width, o: p > 0 && p < 1 ? 1 : 0 });
```
Score: a rising `toneSweep` under the sweep, a `sparkle` as it completes.

## 28. Rack focus

Two depths trade focus on a beat — a change of subject without a cut.

```js
const k = P(t, CUE.rack, CUE.rack + 0.5, ease.inOutCubic);
set(front, { blur: k * 10 * U, o: 1 - 0.3 * k });
set(back, { blur: (1 - k) * 10 * U, s: 1 + 0.03 * k, o: 1 });
```
Blur filters are costly to render: two layers at most, and not on large text that must be read at that moment.
