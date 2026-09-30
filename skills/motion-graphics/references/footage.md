# Footage: films cut from the person's own clips and photos

## Contents
1. When the material is footage
2. Look at it first: scan
3. Pick the moments, plan the edit on the beat
4. Cut: frames at the video's size
5. The screen: drawing footage
6. Speed ramps and slow motion
7. Transitions that carry the motion
8. Grades
9. Surfaces, grids, a screen in the screen
10. Screen recordings: the camera goes where the work happens
11. Photos
12. Sound from the clips, and people speaking
13. Captions
14. Traps

## 1. When the material is footage

When the person gives clips — a trip, an event, a product filmed on a phone, a screen recording — or a folder of
photos, that material is the hero. Type, shapes and interface serve it and never cover the best part of a shot. The
edit is music-led (`sound-design.md`, the sound's role): cuts on the downbeats, the drop on the best shot, the ramps
into the hits. A travel, event or sport reel is dynamic by default: whips that carry the camera's motion, speed ramps
into hits, zoom punches, a freeze with words. A calm request (a wedding film, a spa, a slow travel diary) gets long
holds, slow push-ins and match cuts made with the same care — never slideshow fades.

Footage follows the rules that protect the client: people who did not agree to be filmed are not the subject of a
shot; blur or skip faces, number plates and screens with private data when the person asks or the material is not
theirs.

## 2. Look at it first: scan

```bash
node tools/footage.mjs scan <their clips or a folder>      # in the scaffolded project (SKILL.md step 1)
```

For every clip it prints each shot (it finds the cuts inside a clip), how much moves, which way the camera goes and
how fast ("camera pans right 21 %/s — the picture moves left"), the light (dark, bright), the liveliest and the
calmest second, and for a still shot where the picture changes, second by second. It writes
`assets/footage/scan.json` and a sheet per clip — a frame every second or two with the second in its corner. Open
the sheets: you cannot direct footage you have not looked at. Photos in the folder are listed with their size.

## 3. Pick the moments, plan the edit on the beat

- **The hook is the most kinetic moment**, already moving in frame 1 — the liveliest second of the best shot, not
  the establishing view.
- **Order the shots as a story**: arrive → explore → the peak → a breath → the end; or, for a product, problem →
  hands on it → the result. Group by place or by colour so the grade holds sections together.
- **One shot per beat or two in a drive, one per bar in a calm film.** A shot shorter than half a second reads as a
  flash; use that on purpose (a stutter, a rewind), not by accident.
- **The drop lands on the best shot**; the biggest ramp or punch sits right before it.
- **Plan the transitions from the scan**: a whip continues the direction the outgoing shot's picture moves; a zoom
  punch goes into a still subject; a match cut joins two shots with the same shape, colour or motion.
- The beat map in the README lists every shot with its clip, its source seconds, its ramp keys and its transition.

## 4. Cut: frames at the video's size

```bash
node tools/footage.mjs cut <clip> 12.4-16.0 --name walk [--focus 0.4,0.5] [--scale 1.3] [--fps 60] [--sound]
```

The stretch becomes `assets/footage/walk/00000.jpg …` at the video's size, cover-cropped around the focus (0..1 of
the source; move it onto the subject when a wide shot becomes vertical), at the clip's own frame rate (capped at 60;
phone clips with a varying rate come out constant), and an entry in `js/footage.data.mjs`. Cut only what the edit
uses, with a little extra for the ramps: a vertical frame is 50–300 KB, a minute at 60 fps is 3,600 of them. A shot
the camera pushes into needs `--scale` at least as large as the push (a 1.3× push from a 1× cut is soft). `--sound`
also writes the stretch's sound to `audio/kit/<name>.wav`.

## 5. The screen: drawing footage

Footage and photos are drawn on one WebGL2 canvas under every scene (`js/screen.js`), so type and shapes in the
scene's DOM paint over them. A scene reads `ctx.screen` (it is created on first use), draws its layers every frame,
lists every image it draws in `render.needs(t)` — they are decoded before the frame, which keeps every worker's frame
identical — and sets the frame's effects on `ctx.gl`:

```js
import { P, ease } from '../engine.js';
import { W, H } from '../kit.js';
import { CUE, S } from '../timeline.mjs';
import { view } from '../screen.js';
import { frame, urls, remap } from '../footage.mjs';

const TEAL = { contrast: 1.1, saturation: 1.12, sh: [0, 0.06, 0.12, 0.35], hi: [0.12, 0.06, 0, 0.3] };   // §8

export function build(ctx) {
  const screen = ctx.screen;
  const [a, z] = S.walk;
  const src = remap([[a, 0], [CUE.ramp, 1.2], [z, 3.4]]);   // output second → source second
  const at = (t) => frame('walk', src(t));
  const render = (t) => {
    if (t < a || t > z) return;
    const fr = at(t);
    const push = 1 + 0.06 * P(t, a, z);                      // a slow push the whole shot
    screen.draw(fr.url, view({ z: push, cx: 0.5, cy: 0.45 }).m, { next: fr.next, mix: fr.mix, grade: TEAL });
    ctx.gl.used = true;                                       // the screen shows this frame
  };
  render.needs = (t) => (t < a || t > z ? [] : urls(at(t)));
  return render;
}
```

- `view({ sw, sh, z, cx, cy, px, py, r })` places a source of `sw × sh` px (default: the video's size, as `cut`
  makes it): the source point (cx, cy) lands on the screen point (px, py), `z` relative to cover, `r` degrees. Its
  `css` puts a DOM element (a label, a sticker, a cursor) on the same picture.
- `screen.draw(url, m, { op, blend, grade, next, mix, feather, mask, clampOut })` — `blend` 'normal', 'screen',
  'add' or 'max'; `mask` [x0, y0, x1, y1] in the source's 0..1; `feather` a soft edge.
- `ctx.gl` (the effects pass, for the whole screen): `zb` [x, y, strength] zoom blur, `rgb` px + `rgbAngle` or
  `rgbRadial`, `glitch` 0..1 + `glitchH` + `glitchSeed`, `vhs` + `vhsSquash` + `vhsBand`, `crtX` / `crtY` (a CRT
  squeeze, 1 = full) + `crtGlow` + `scan`, `spot` [x, y, radius, strength], `flash` (white), `fade` (black), `grade`.
- Everything is a function of t (a glitch's seed too: `glitchSeed: Math.floor(t * 30)`), and fast moves are in
  `WHIPS`: the renderer's motion blur then smears a whip over 16 real samples.

## 6. Speed ramps and slow motion

`remap(keys)` turns [output second, source second] keys into a smooth curve that never runs backwards (unless the
keys do). The slope is the speed (`src.speed(t)`): steeper runs faster than life, shallower is slow motion, two equal
source seconds freeze the frame.

- **Ramp into a hit**: 1× → 3–5× over the beat before the hit → the hit → 0.3–0.5× right after it; the whip or the
  punch sits on the fastest part.
- **Slow motion** blends two neighbouring frames (`next`, `mix` from `frame()`), so a 30 fps clip slows without
  stutter; 60 fps footage slows cleaner. `frame(name, s, { blend: false })` for a hard, stepped look.
- **Steps on the beat**: put keys at the source seconds where a foot lands and at the output beats you want them on;
  the score reads the same `remap` to place the footsteps.
- **A rewind** is keys that go back in source time; add `vhs` and `rgb` for the tape look.

## 7. Transitions that carry the motion

- **Whip that continues the camera**: the outgoing shot's picture keeps moving the way the scan says it moves ("the
  picture moves left" → out to the left over 0.2–0.3 s, `ease.inOutCubic`), the next shot enters from the other side;
  `zb` and `rgb` peak in the middle (`Math.sin(Math.PI * p)`), a whoosh on it, the pair in `WHIPS`.
- **Zoom punch-through**: z 1 → 3 over a beat (`zoomLog`), `zb` rising at the end, the next shot starts at z 1.25 →
  1 on the downbeat.
- **Spin**: r 0 → 90 with a push, the next shot from −90 → 0; for one hit per film, not every cut.
- **Flash cut**: `flash` 1 → 0 over three frames on the downbeat.
- **Glitch hit**: `glitch` 0.5–0.7 for two frames on a hit, a new `glitchSeed` each frame.
- **Freeze + words**: a flat stretch in the ramp, a colour pass (`grade: { pass: 1, passHue: <the subject's or the
  brand's hue> }`), the words slam in; a shutter or a tape stop.
- **Echo trail**: the last three frames drawn again behind the current one with `op` 0.35 / 0.2 / 0.1 and `blend:
  'screen'` (`frame('walk', src(t - k * 0.05))`; list them in `needs`).
- **Match cut**: two shots with the same shape, colour or direction — planned from the sheets, cut on the downbeat.
- **CRT off / on**: `crtY` 1 → 0.01 then `crtX` 1 → 0 (off); the reverse to open a section.

## 8. Grades

One grade per place or per section, kept across its shots: the film looks shot by one person. Start from these and
move them towards the brand's colours:

| Look | grade |
|---|---|
| Teal and orange (travel, sport) | `{ contrast: 1.1, saturation: 1.12, sh: [0, 0.06, 0.12, 0.35], hi: [0.12, 0.06, 0, 0.3] }` |
| Warm film (a diary, food) | `{ contrast: 1.05, saturation: 0.9, tint: [1.06, 0.98, 0.9], tintAmt: 0.6, crush: 0.04 }` |
| Night city | `{ exposure: -0.2, contrast: 1.15, saturation: 0.85, sh: [0, 0.03, 0.12, 0.4], hi: [0.15, 0.08, 0, 0.25] }` |
| Black and white punch | `{ bw: 1, contrast: 1.25, crush: 0.03 }` |
| Colour pass | `{ pass: 1, passHue: 0 }` — everything grey but red (60 yellow, 120 green, 210 blue) |

A dark shot gets `exposure` 0.3–0.6 before anything else; a shot that stays muddy is left out.

## 9. Surfaces, grids, a screen in the screen

- **A picture on a surface** (a phone screen, a billboard, a poster): `screen.draw(url, mat.inv(mat.square2quad([p0,
  p1, p2, p3])))` — p0..p3 are the picture's corners on screen in px (top-left, top-right, bottom-right,
  bottom-left); move them with the surface and the picture stays glued to it.
- **A grid of shots**: one `draw` per cell with a `view()` whose `px, py` is the cell's centre and `mask` its box;
  cells pop in on the 16ths, one plays while the others hold their first frame.
- **A screen in the screen**: `feather` 0.02 for a soft edge, then the camera dives into it (z → cover) on a riser.

## 10. Screen recordings: the camera goes where the work happens

A recording shown whole is unreadable on a phone. The scan's `activity` of a still shot says where the picture
changes, second by second — the camera's targets. Zoom so the change fills about 60 % of the frame, hold while it
happens, move on the beat before the next:

```js
import scan from '../../assets/footage/scan.json' with { type: 'json' };   // or copy the boxes into the scene
import { track, SPRING } from '../engine.js';
import { CUTS, frame, urls } from '../footage.mjs';
const [a] = S.demo;                                        // the scene plays the cut 'demo' at 1× from its start
const act = scan.clips.find((c) => c.name === 'recording').shots[0].activity;
const keys = act.map(({ t, box: [x0, y0, x1, y1] }) =>
  [a + t - CUTS.demo.from, [(x0 + x1) / 2, (y0 + y1) / 2, Math.min(2.4, 0.6 / Math.max(x1 - x0, y1 - y0))]]);
// every frame:
const [cx, cy, z] = track(t, keys, SPRING.base);
const fr = frame('demo', t - a);
screen.draw(fr.url, view({ z: Math.max(1, z), cx, cy }).m, { next: fr.next, mix: fr.mix });
```

The boxes are in the clip's own frame: they match the cut when the recording keeps its shape (a wide recording in a
wide film); for a vertical film cut from a wide recording, set `--focus` on the work and convert the boxes by the
crop, or plan the targets from the sheet by eye.

Cut the recording with `--scale` equal to the deepest zoom (2 for 2×) and `--fps 30`. Text in focus is at least 28 px
on screen at 1080p; a click gets a sound and a small punch; the cursor can be drawn in the DOM with `view().css`.

## 11. Photos

`screen.draw('assets/img/photo.jpg', view({ sw, sh, z, cx, cy }).m)` with `[sw, sh] = screen.size(url)` (known once
decoded; list the photo in `needs`). The photo's own orientation is respected. A photo is never shown still: a slow
push (z 1 → 1.08 over its time), a drift towards the subject, or a parallax of two crops; photos cut together on the
beat read as a reel, not a slideshow. A photo wall, a split-flap of places, a map with pins between them:
`scene-cookbook.md`.

## 12. Sound from the clips, and people speaking

`cut --sound` keeps the stretch's own sound — waves, a crowd, an engine — as a brand-world sound: `sample(t,
'audio/kit/<name>.wav', { align: 'start', vel: 0.5 })` under the music at 1× shots. A ramped shot's natural sound would
run at the wrong speed: give it designed sounds instead (a whoosh on the whip, an impact on the punch).

When someone speaks — a founder to camera, a testimonial, a guide, a toast — the sound leads and the picture
follows:

- **Cut where it is quiet.** The scan lists each clip's quiet stretches (≥ 0.35 s): those are the clean cuts between
  phrases. 0.15–0.35 s works after a look at the frames; anything shorter is inside a phrase. Never inside a word.
- **Pad every cut** 30–200 ms around the kept words — tight for a punchy reel, loose for a calm film — and keep a
  laugh or a reaction after a punchline: it is part of the beat.
- **Filler and dead air go** ("um", false starts, the pause before a retake); the best take of each line wins, in
  the story's order, not the recording's.
- **The music ducks 12–15 dB under the voice** and comes back up in the gaps; it steps out before the end card
  instead of fading under the call to action.
- **An animation lands on its word**: start its reveal that many seconds before the word it illustrates, so the
  landing frame and the word coincide.

## 13. Captions

Most feeds play muted: a video with speech carries its words on screen. The words come from the person — an SRT or
VTT (a phone's or an editor's export, a transcription they made) or word timings as JSON; this skill does not
transcribe (a local speech-to-text tool is used only when it is already installed and the person agrees).

```js
import { el, set, clamp } from '../engine.js';
import { S } from '../timeline.mjs';
import { CUTS } from '../footage.mjs';
import { wordsOf, chunks, shift, at } from '../captions.mjs';
// build (it may be async): the clip's subtitles, moved to the film's time — the cut 'talk' plays at 1× from S.talk[0]
const subs = await (await fetch('assets/footage/talk.srt')).text();
const caps = shift(chunks(wordsOf(subs), { max: 2, upper: true }), S.talk[0] - CUTS.talk.from);
const box = el('div', 'caption', ctx.stage);            // CSS: z-index above every scene; the heavy display face
// frame:
const c = at(caps, t);
box.innerHTML = c ? c.words.map((w) => `<span class="${t >= w.start ? 'on' : ''}">${w.w.toUpperCase()}</span>`).join(' ') : '';
set(box, { y: 0, s: c ? 1 + 0.08 * (1 - clamp((t - c.start) / 0.12)) : 1, o: c ? 1 : 0 });   // a small pop per chunk
```

- One or two words at a time for a reel, four to seven for a calm film; a chunk never flashes for less than a third
  of a second (`chunks` grows it instead).
- The word being said lights up in the accent colour; the others stay white with a dark outline or shadow.
- Inside the safe area of the platform: in 9:16 above the bottom ~320 px and below the top ~220 px; never over the
  speaker's mouth.
- Captions paint over everything — footage, type, stickers: nothing may cover them. Escape the words if the text
  can hold `<` or `&`.
- A shot played at another speed moves its words with the ramp: map each word's time through the inverse of the
  ramp, or keep speaking shots at 1×.

## 14. Traps

- **An image drawn but not listed in `needs`** is not decoded yet: that frame is empty (QA `flash` or `pops`). List
  every url a frame draws — the echo's too.
- **A push into a 1× cut** softens the picture: cut it with `--scale`.
- **Every shot the same length** reads as a slideshow; vary them with the music (short in the build, long after the
  drop).
- **Covering the best part of a shot with type**: put words where the scan's calm second leaves room, or in the sky.
- **Too much at once**: one effect per hit (a glitch or a flash or a punch), the rest of the shot clean.
- **WebGL2 is needed**: Chrome and Edge have it; a headless render may draw it in software — slower, the same frames.
