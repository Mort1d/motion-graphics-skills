# __BRAND__ — promo

<!-- one line: length, format, fps; the sound in five words (genre, BPM, key) -->

Everything is code: the picture is an HTML page rendered frame by frame in headless Chrome with motion blur; the score
and every sound effect are synthesised in Node on the same timeline. Facts and their sources: `brief.md`; the critique
rounds: `REVIEW.md`.

## Direction card

<!-- filled before any scene (SKILL.md step 3, references/direction.md §7); tools/plan-check.mjs reads the Energy line -->

- Film in one line (what the viewer feels and does at the end):
- Read from (the person's words quoted, what they gave, where it plays, the brand's voice):
- Concept (the device carried from the first frame to the last, and its signature moment):
- Not taken (the other two concepts, one line each):
- Look (a card from look-cards.md, and what changes for this brand):
- Energy (per scene = ENERGY, and where it came from — their words, the references, the promo default, a reason for calm):
- Mood (bright or dark, playful or serious):
- Sound role (music-led or ui-led):
- Palette (roles → hex):
- Type (families, weights, sizes, the accent face):
- Hard cuts (beats):
- Banned in this video: a scene counter or chapter label ("01 / 06"), HUD (timecodes, BPM, corner brackets),
  cross-fades, a logo alone on black first, …

## Story

| Time | Bars | Picture — how it enters, what holds, how it leaves | Sound |
|---|---|---|---|
| 0–… s | 1–2 | hook: … | … |

## Sound brief

- Feel / genre:
- Tempo & key:
- Groove:
- Kit:
- Percussion:
- Bass:
- Harmony:
- Hook (sonic logo):
- Brand world:
- Energy map:
- Transitions:
- Mix:
- Not like the last one because:

## Build

```bash
node tools/plan-check.mjs            # the plan (js/timeline.mjs + the Energy line above) before any scene
node tools/capture.mjs sheet 0 <duration> 24     # contact sheet → out/sheet.png
node tools/capture.mjs verify        # every frame a function of t (forward, backward, shuffled)
node audio/score.mjs --report        # the score → out/music.wav (+ per-bus balance per scene)
node tools/audio-check.mjs           # loudness, balance, energy arc, uniqueness, out/qa/music-audio.png
node tools/capture.mjs review        # the critique set → out/review/ (score it in REVIEW.md)
node tools/render.mjs --draft        # quick preview with sound
node tools/render.mjs                # final → out/<slug>.mp4, out/<slug>-web.mp4, out/covers/, QA
node tools/aac.mjs out/*.mp4         # loudness and true peak of each delivery file (≤ -1 dBTP)
```

## Where things are

| Path | What |
|---|---|
| `js/timeline.mjs` | tempo, scene windows, cues, the energy plan — shared by picture and sound |
| `js/copy.mjs` | every word on screen and the contacts, per language |
| `js/scenes/*.js` | the scenes, in the order of `SCENES` in `js/reel.js` |
| `audio/score.mjs` | the score and the sound design |
| `audio/kit/` | recorded sounds the person supplied (`tools/kit.mjs`), with their licences in `KIT.md` |
| `assets/ui/` | the product's real interface, element by element (`ui-shot.mjs`) |
| `css/style.css` | brand colours and shared styles |

## Assumptions

- …
