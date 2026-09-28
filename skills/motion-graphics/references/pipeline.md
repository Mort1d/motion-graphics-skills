# Pipeline: previews, renders, formats, delivery, troubleshooting

## Contents
1. Project layout
2. The capture protocol
3. Fonts and images
4. Previewing without rendering
5. Rendering
6. Motion blur
7. Formats and platforms
8. Language cuts
9. Cutdowns and covers
10. QA
11. Troubleshooting (known traps)

## 1. Project layout

```
index.html, css/fonts.css, css/style.css    the page (brand tokens in style.css)
js/timeline.mjs    W, H, FPS, BPM, b(), DURATION, S (scene windows), CUE, WHIPS, COVERS — shared with the score
js/copy.mjs        every word and contact, per language — shared with the score
js/engine.js, js/kit.js, js/main.js, js/reel.js, js/i18n.js
js/scenes/*.js     one file per scene: build(ctx) → (t) => void; SCENES in reel.js lists them in order
audio/score.mjs    this video's score;  audio/synth/  the synth library
tools/capture.mjs, render.mjs, qa.mjs, audio-check.mjs, sound-print.mjs (+ demo-print.json), cutdown.mjs, aac.mjs
assets/fonts, assets/img, out/ (renders), .cache/ (browser profiles, render chunks)
brand/             site-kit.mjs: site.md, site.json, shots/, sections/, logo/, fonts/ (+ fonts.css), img/, palettes
refs/              references (fetched clips + <name>.post.json), refs/analysis/ (ref-sheet: sheets and numbers)
```

## 2. The capture protocol

`tools/capture.mjs` serves the project on a random local port, opens `index.html` in a headless Chromium (Chrome, Edge,
Chromium or Brave — found automatically; `--browser <path>` or env `CHROME_PATH` to choose), and talks to it over the
DevTools protocol. The page must expose `window.__ready` (true after fonts, images and scenes are built),
`window.__render(t, frame)` (draw time t), and optionally `window.__samples(t)` (blur samples wanted: 16 in WHIPS,
else 8). Every browser gets its own profile in `.cache/browser/` and its own ports, so several renders can run side
by side on one machine — never kill browser processes you did not start.

## 3. Fonts and images

- `main.js` loads every `@font-face` in `css/fonts.css` before building; a missing file prints `[fonts] cannot load`.
- The template bundles Montserrat 700 / 900 / 900 italic and JetBrains Mono 400 / 700 (SIL OFL; Latin, Cyrillic, ₽ € №,
  arrows). A character a font lacks is drawn by a system font and looks pasted in: `main.js` prints
  `[fonts] <family> has no glyph for "₽"` for every such case in the built scenes. Use the
  brand's font files if you have them, or an OFL font (fonts.google.com); keep the licence file next to them.
- `site-kit.mjs` downloads the Google Fonts a site uses into `brand/fonts/` as full TTFs (every script in one file,
  static weights 100 apart) and writes `brand/fonts/fonts.css` with rules ready for `css/fonts.css`; its coverage line
  says whether each has Cyrillic, ₽, №, «», —. Sites rename fonts ("brandMulish", "__Inter_1a2b3c", "plexMono"); the
  tool maps them back to the Google name.
- Some display fonts lack glyphs (a no-break space, ₽, №, arrows) and show empty boxes: replace the character or pick
  a font that has it; check every language's sheet.
- Images: PNG / JPG / WebP in `assets/img`, pre-scaled to ≤ 2× their on-screen size; preloaded as `<img>` in build.

## 4. Previewing without rendering

```
node tools/capture.mjs sheet 0 12 24 [--query only=hook,proof] [--cols 6]     contact sheet (with a time label)
node tools/capture.mjs still 3.75 4.2 8 [--out out/stills] [--debug]          full-size PNG frames
node tools/capture.mjs eval "document.querySelectorAll('.card').length" --times 5
```
Times are seconds, or beats with a `b` suffix (`still 16b 16.5b`, `sheet 0b 32b 24`, `render.mjs --range 24b-32b`) —
the timeline counts in beats, the tools in seconds; the suffix saves the conversion mistakes.
`?only=scene1,scene2` builds a subset (fast); `?debug` shows time / beat / bar. Look at the sheet after every scene,
and at full-size stills around every CUE and transition (± 0.1 s): overflow, overlaps, empty frames, readability.

## 5. Rendering

```
node audio/score.mjs                       the score first (out/music.wav)
node tools/render.mjs --draft              half size, no blur: ~1–2 min for 30 s — timing check with sound
node tools/render.mjs                      full quality → out/<slug>.mp4, out/<slug>-web.mp4, out/covers/, QA
node tools/render.mjs --range 12-18        re-render only the 2-s chunks touching 12–18 s, reuse the rest
node tools/render.mjs --skip-frames        re-mux only (after changing the score) — seconds
```
`--jobs N` sets parallel browsers (default ≈ CPU threads / 3; lower it on a busy machine), `--chunk` the chunk
length, `--query lang=en` a language cut, `--grain 0` no film grain. Full quality costs roughly 1–2 minutes of wall
time per second of video on 3–4 workers at 1080p60 with blur; plan renders, don't repeat them for small fixes —
use `--range`.

## 6. Motion blur

Each output frame averages up to 16 captures spread over a 180° shutter (half the frame interval), in ffmpeg (`tmix`).
Frames where nothing moves are detected (first and last capture identical) and captured twice instead of 16 times,
so static holds are cheap. `WHIPS` in the timeline marks fast moves for 16 samples; elsewhere 8. Blur comes for free
from real motion — never fake it with CSS blur.

## 7. Formats and platforms

`scripts/new-project.mjs --format 16:9 | 9:16 | 1:1 | 4:5` sets `W × H`; scenes size things in `U` (1 = 1080 px on
the short side) and can branch on `VERTICAL`.
- 16:9 1920×1080 — YouTube, X, VK, Telegram, websites.
- 9:16 1080×1920 — Reels, Shorts, TikTok, VK Clips, Stories: keep text inside the middle 1080×1420 (UI covers the top
  ~220 px and the bottom ~320 px).
- 1:1 / 4:5 — feeds.
- 60 fps for motion-heavy work (default), 30 fps halves render time.
- Master: H.264 High, CRF 15, yuv420p, AAC 320k 48 kHz, faststart. Web: CRF 21, AAC 192k, capped bitrate — small enough
  for messengers.
- Every delivery file's audio goes through `tools/aac.mjs`: FFmpeg's AAC encoder can add several dB of peak (a −5 dBTP
  score came out at 0.0 dBTP in a 192k copy), mostly through noise substitution and intensity stereo. Both are off, the
  encode is measured after decoding and made quieter by the excess if it still tops −1 dBTP. `node tools/aac.mjs <file>`
  prints any file's loudness and true peak.

## 8. Language cuts

Add `COPY.xx` in `js/copy.mjs` (same keys), then `node audio/score.mjs --lang xx` (sound that follows the text — typing
clicks, one pop per word — changes with it) and `node tools/render.mjs --query lang=xx`. `fitFont()` keeps longer
translations inside the frame; check a sheet of the new cut. To prove a cut did NOT change after edits to shared
code, compare a hash of `#stage` markup over many times (`capture.mjs eval`) and the WAV's md5 before and after —
pixels vary run to run, markup and audio bytes do not.

## 9. Cutdowns and covers

`node tools/cutdown.mjs --ranges "0b-8b,24b-32b,56b-64b"` builds a short version from the rendered frames and the
score, cut on bars (`b` = beats), with 20 ms audio fades at joins and a longer fade at the end, then QA'd like the
master. Covers: the times in
`COVERS` are saved as PNGs after the final render (a strong mid-video frame and the end card).

## 10. QA

`tools/qa.mjs` runs after every render: codec, size, fps, duration against the timeline, audio stream, loudness and
true peak, black stretches, frozen stretches (a held end card is expected), `flash` (runs of near-empty frames
between scenes — the gap a 24-frame sheet never lands on; look at stills there), the `look` (dark / light — is it the
brand's?), silences, leftover `@template-demo` code in the files the video uses, whether the soundtrack is new
(`unique`: FAIL on the demo score, WARN at ≥ 0.75 to a promo next to this project), and a contact sheet of the
encoded file (`out/qa/<name>-sheet.png` — look at it). No FAIL may remain; every `flash` is either fixed or a hold
you meant.
`tools/audio-check.mjs` checks the score alone (sound-design.md §11) and whether it is new (§12): it writes
`out/qa/<name>-print.json`, which later projects in the same folder compare against. `node tools/sound-print.mjs
a.wav --against b.wav dir/` compares any files (it reads mp3/mp4 too; the first analysis of a file is cached).

## 11. Troubleshooting (known traps)

| Symptom | Cause | Fix |
|---|---|---|
| `page never set window.__ready` | a scene threw while building (see `[page error]`), or a missing module | fix the error; run `still 0` to iterate |
| text in a fallback font / wrong widths | font file missing or not declared | check `[fonts]` warnings, paths in css/fonts.css |
| element stays invisible after a fade | `set()` without `o` falls back to CSS; `vis: false` sticks until `vis: true` | pass `o` every frame; pass `vis: true` when showing |
| two transforms fight | `set()` rebuilds the whole transform | combine x, y, s, r in one call |
| a scene's background hides the previous scene | an early window with an opaque backdrop | fade the backdrop in with its first element |
| a visible browser window pops up | `chrome.exe --version` on Windows launches the browser instead of printing | never run it; `capture.mjs doctor` finds the browser without starting it |
| a process "ended" at once but is still running (Windows, Git Bash) | `kill -0 <pid>` does not see Windows PIDs | check with PowerShell `Get-Process -Id <pid>` |
| render: "the project changed during the render" | a file was edited while chunks were rendering | re-render what the edit touches (`--range`), or everything; edit between renders |
| the previous scene shows through a new scene after its wipe | a `clipPath` wipe hides, it does not paint | give the clipped scene an opaque `var(--bg)` background |
| a few flat frames between a wipe and the next slam (QA: `flash`) | something is gated to its own cue (`o: t < cue ? 0 : …`) while the thing before it has already gone — a backdrop, a glow or the hero itself | blend the incoming element with the transition's progress; `capture.mjs sheet a b 12` across the range QA names |
| a wipe reads as a flash | too fast / wrong ease | `inOutSine` over ≥ 0.3 s |
| blank or half-drawn frames | an image swapped mid-render, or unloaded | preload `<img>`s; don't change `src` per frame |
| Node cannot import a shared module | the score imported a `.js` file (CommonJS in Node) or one that touches the DOM | shared data in `.mjs`, no DOM at module level |
| render much slower than expected | huge images, animated CSS filters on big layers, too many workers for the CPU | pre-scale images, bake filters, lower `--jobs` |
| `EADDRINUSE` / a stuck profile | an old custom script with fixed ports | the tools pick free ports; delete `.cache/browser/<stale>` |
| audio clicks | a voice without attack / release ramps, or a cut without fades | ramp every start / end; `cutdown.mjs` fades joins |
| loudness far off target | a huge peak (fx hit) makes the limiter pull hard | lower that bus; see the render's limiter report |
| `/json/new?url` loses query params after `&` | a DevTools quirk | the tools open about:blank, then navigate |
| numbers or words cut at the edges | long translations / big numbers | `fitFont()`; wider boxes; check every language |
| system drive fills up | caches in the temp folder | the tools keep caches in the project's `.cache/` |
| site-kit: "the site shows a bot check" | the site blocks automated browsers | do not work around it; ask the user for screenshots and the texts |
| site-kit: no logo found, or the candidates are icons | a wordmark drawn in CSS, a canvas logo, an unusual header | the 4× screenshots in `brand/logo/`, the icons and the share image; else ask for the file |
| site-kit: a font "not on Google Fonts" | the site serves its own (possibly licensed) font, or Adobe Fonts | use it only if the client owns it; otherwise the closest open font |
| site-kit: empty areas in a screenshot | content that appears on scroll or on hover | the tool scrolls through with reduced motion; use `sections/` and the phone shots, or ask for screenshots |
| site-kit on a t.me link gives only an avatar | the page's logo, colours and fonts are Telegram's | by design: the avatar's palette and the description are the brand's |
| ref-sheet: NOT FETCHED "the post has no video or image" | a text post, an X article, a thread whose clip is in a reply | ask for the clip or the right post link |
| ref-sheet: NOT FETCHED "… without yt-dlp" | YouTube, Instagram, TikTok, Vimeo need yt-dlp | ask for the file; install yt-dlp only with the user's consent |
| ref-sheet: "no hard cuts: one continuous shot" | motion design moves by wipes and morphs, not cuts | read the motion line (hits per minute, share on the beat) and the key-frame sheet |
