# __BRAND__ — promo

<!-- one line: length, format, fps; the sound in five words (genre, BPM, key) -->

Everything is code: the picture is an HTML page rendered frame by frame in headless Chrome with motion blur; the score
and every sound effect are synthesised in Node on the same timeline. Facts and their sources: `brief.md`.

## Story

| Time | Bars | Picture | Sound |
|---|---|---|---|
| 0–… s | 1–2 | hook: … | … |

## Direction

- Palette (roles → hex):
- Type (families, weights, sizes):
- Hard cuts (beats):
- Banned in this video: a scene counter or chapter label ("01 / 06"), HUD (timecodes, BPM, corner brackets),
  cross-fades, a logo alone on black first, …

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
node audio/score.mjs --report        # the score → out/music.wav (+ per-bus balance per scene)
node tools/audio-check.mjs           # loudness, balance, energy arc, uniqueness, out/qa/music-audio.png
node tools/capture.mjs sheet 0 <duration> 24     # contact sheet → out/sheet.png
node tools/render.mjs --draft        # quick preview with sound
node tools/render.mjs                # final → out/<slug>.mp4, out/<slug>-web.mp4, out/covers/, QA
node tools/aac.mjs out/*.mp4         # loudness and true peak of each delivery file (≤ -1 dBTP)
```

## Where things are

| Path | What |
|---|---|
| `js/timeline.mjs` | tempo, scene windows, cues shared by picture and sound |
| `js/copy.mjs` | every word on screen and the contacts, per language |
| `js/scenes/*.js` | the scenes, in the order of `SCENES` in `js/reel.js` |
| `audio/score.mjs` | the score and the sound design |
| `css/style.css` | brand colours and shared styles |

## Assumptions

- …
