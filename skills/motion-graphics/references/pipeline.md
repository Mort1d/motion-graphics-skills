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
11. What to re-run after a change
12. Long films
13. Another engine: Remotion, HyperFrames, an editor
14. Troubleshooting (known traps)

## 1. Project layout

```
index.html, css/fonts.css, css/style.css    the page (brand tokens in style.css)
js/timeline.mjs    W, H, FPS, BPM, b(), DURATION, S (scene windows), ENERGY (per scene), CUE, WHIPS, COVERS, LOOP — shared with the score
js/copy.mjs        every word and contact, per language — shared with the score
js/engine.js       time: ease, spring, SPRING, track, zoomLog, hash, noise; the DOM: el, set, show, splitChars
js/kit.js          scene helpers: textBlock, fitFont, slam, whip, rise, camera, roll, scramble, shakes, sparks, speed lines
js/main.js, js/reel.js, js/i18n.js
js/scenes/*.js     one file per scene: build(ctx) → (t, frame) => void; SCENES in reel.js lists them in order
js/screen.js       the WebGL footage screen (created on first use);  js/footage.mjs  frames and speed ramps;
                   js/footage.data.mjs  the cuts (written by tools/footage.mjs);  js/captions.mjs  SRT / VTT → chunks
audio/score.mjs    this video's score;  audio/synth/  the synth library;  audio/kit/  recorded sounds + KIT.md (tools/kit.mjs)
tools/             capture, render, qa, plan-check, pops, audio-check, energy, sound-print (+ demo-print.json), kit,
                   footage, cutdown, aac, export-timeline (all .mjs)
README.md          the direction card, the story table, the sound brief;  brief.md  facts + sources;  REVIEW.md  critique rounds
assets/fonts, assets/img, assets/ui (ui-shot.mjs: element PNGs + ui.json), assets/footage (scan.json, sheets, cuts)
out/               renders, covers/, qa/, review/, stills/, timeline.json;  .cache/  browser profiles, render chunks
brand/             site-kit.mjs: site.md, site.json, shots/, sections/, logo/, fonts/ (+ fonts.css), img/, palettes
refs/              references (fetched clips + <name>.post.json), refs/analysis/ (ref-sheet: sheets and numbers)
```

## 2. The capture protocol

`tools/capture.mjs` serves the project on a random local port, opens `index.html` in a headless Chromium (Chrome, Edge,
Chromium or Brave — found automatically; `--browser <path>` or env `CHROME_PATH` to choose), and talks to it over the
DevTools protocol. The page must expose `window.__ready` (true after fonts, images and scenes are built),
`window.__render(t, frame)` (draw time t), and optionally `window.__samples(t)` (blur samples wanted: 16 in WHIPS,
else 8). Scenes get `(t, frame)`: `t` moves inside the shutter for motion blur, `frame` is the output frame every
sample of it shares — text that changes is computed from `frame / FPS`, so a blurred frame never mixes two values.
With `LOOP` in the timeline, `__render` wraps `t` into [0, DURATION): the last scene can run into the first one's
look, and QA's `loop` row checks that the last frame meets the first. Every browser gets its own profile in
`.cache/browser/` and its own ports, so several renders can run side by side on one machine — never kill browser
processes you did not start.

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
node tools/capture.mjs review [--out out/review]                         the critique set (below)
node tools/capture.mjs verify [--n 12]                                   is every frame a function of t?
```
Times are seconds, or beats with a `b` suffix (`still 16b 16.5b`, `sheet 0b 32b 24`, `render.mjs --range 24b-32b`) —
the timeline counts in beats, the tools in seconds; the suffix saves the conversion mistakes.
`?only=scene1,scene2` builds a subset (fast); `?debug` shows time / beat / bar. Look at the sheet after every scene,
and at full-size stills around every CUE and transition (± 0.1 s): overflow, overlaps, empty frames, readability.

`review` writes what a harsh director looks at before a render (SKILL.md step 7): `beats.png` — a frame on every
beat, the whole film on one page; `phone.png` — frames at 360 px wide, as a feed shows them, without the debug
overlay (can the words be read?); `strip-<t>s.png` — 12 frames through the middle of each fast move in `WHIPS`
(does it smear the right way, does anything pop?). `verify` renders the same frames forward, backward and shuffled
and hashes what is visible (elements and canvases): a scene that keeps state between frames, reads the clock or
rolls `Math.random` FAILs — the kind of bug that makes chunks rendered by different workers not join. Run it
after each scene, and before every full render.

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

Nothing half-made replaces a good file: every chunk and every delivery file is written beside its final name
(`.partial`) and moved there only when complete. A stopped render resumes with `--range <where it stopped>-<end>`:
the chunks already in `.cache/` are reused, and a chunk missing anywhere is rendered too. On Windows a video open
in a player cannot be replaced — the render says so and leaves the new one as `<name>.partial.mp4`.

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
you meant. Four rows read the picture the way a viewer does:

- `hook` — the longest still stretch in the first 1.5 s: over 0.5 s, the opening waits instead of grabbing (WARN);
- `pops` — a single frame unlike both its neighbours while they match each other (a flicker, a scene shown for one
  frame, an element that blinks at a boundary); the times are listed — look at stills there (`tools/pops.mjs
  <video>` runs it alone);
- `edges` — text cut by the frame at a settled moment of a scene (a long word, a translation, a number that grew);
- `loop` — only with `LOOP`: the last frame against the first; a visible jump FAILs.

Before any of this, `tools/plan-check.mjs` checks the plan itself (SKILL.md step 4): the energy the person asked
for against `ENERGY`, the first second, something new every 4 s, the end card's hold, holes between scenes, a scene
counter in the copy.
`tools/audio-check.mjs` checks the score alone (sound-design.md §11) and whether it is new (§12): it writes
`out/qa/<name>-print.json`, which later projects in the same folder compare against. `node tools/sound-print.mjs
a.wav --against b.wav dir/` compares any files (it reads mp3/mp4 too; the first analysis of a file is cached).

## 11. What to re-run after a change

| You changed | Re-run |
|---|---|
| a word or a contact (`js/copy.mjs`) | stills of the scenes that show it; `audio/score.mjs` when sound follows the text (typing, a pop per word); `render.mjs --range` over those scenes |
| one scene file | its sheet and stills, `capture.mjs verify`; `render.mjs --range <its window>` |
| `js/timeline.mjs` (tempo, windows, cues) | `plan-check.mjs`, the score, a full render — every frame after the change moves |
| `audio/score.mjs` | `score.mjs --report`, `audio-check.mjs`, `render.mjs --skip-frames` (seconds: no frames are captured) |
| colours or fonts (`css/`, `assets/fonts`) | stills in every language; a full render |
| a recorded sound (`audio/kit/`) | `tools/kit.mjs` on the new file (its peak moves), the score, `render.mjs --skip-frames` |

## 12. Long films

Past ~90 seconds a video is built like a film: one plan, several makers, stricter checks.

- **Pick the sync backbone before any scene.** The beat grid (the default) holds to about 90 s. A film cut to an
  existing song takes the song's grid and drops from `ref-sheet.mjs`; sung words appear from a table of lines
  `[start, end, text]`, each word revealed over a share of its line (longer words take longer). A chorus that comes
  back returns to the same stage and escalates it each time — the motif the viewer learns. A voiced film is driven by
  its narration: the scene windows are the real clip lengths chained together (a short pause before, a gap between,
  a tail after), never hand-picked seconds. The person supplies the voice-over files (or an SRT / VTT with line
  times); `tools/kit.mjs vo/*.wav` gives each clip's length.
  ```js
  // js/timeline.mjs — a voiced film: the clip lengths from audio/kit/KIT.md, in the order of the script
  const VO = [['hook', 3.84], ['problem', 6.21], ['how', 9.02], ['proof', 7.4], ['end', 4.1]];
  const PRE = 0.5, GAP = 0.4, TAIL = 2.5, OVER = 0.3; // a breath before the first line, between lines, after the last
  export const LINE = {};                             // where each clip starts
  let at = PRE;
  for (const [name, len] of VO) { LINE[name] = at; at += len + GAP; }
  export const DURATION = at - GAP + TAIL;
  const from = VO.map(([n]) => LINE[n] - PRE);        // a scene arrives just before its line; the first one at 0
  export const S = Object.fromEntries(VO.map(([n], i) => [n, [from[i], i + 1 < VO.length ? from[i + 1] + OVER : DURATION]]));
  ```
  The score places each clip from the same table — `sample(LINE.hook, 'audio/kit/vo-hook.wav', { align: 'start' })` —
  and thins its parts while a line plays; the hits still sit on the beat grid inside the windows.
- **One story bible.** The direction card grows: a palette arc per chapter, one recurring motif that pays off at the
  end, and for a dense stretch the reads (`story-and-motion.md` §4) in order, each with its window.
- **Split the work so no two makers touch one file.** A film of vignettes splits in time — one scene file per
  20–40-second chapter, each importing the shared timeline, palette and kit. One continuous world splits by concern —
  the camera, the map, the particles, the overlay each own a module every scene calls. Each maker edits only their
  file; a bug in a shared file is reported to whoever owns it, never patched in passing.
- **Brief every maker with the same words.** Paste the direction card's palette, type and banned list verbatim into
  every maker's brief — a paraphrase drifts the look within two chapters. Give each its window and its slice of the
  cues; done means a sheet across its own boundaries and `verify` passing on its range.
- **Render in larger pieces.** `--chunk 4` or more cuts the per-chunk overhead of a five-minute render; iterate with
  `--range` and never re-render the whole film for one fix.

## 13. Another engine: Remotion, HyperFrames, an editor

`node tools/export-timeline.mjs` writes `out/timeline.json`: the size and fps, every scene window in seconds and in
frames, the named cues with their beats, the fast moves, the energy plan and the score's path. A Remotion composition
places its `<Sequence from={fromFrame} durationInFrames={frames}>` and its `<Audio>` from it; a HyperFrames page its
clips; an editor its markers. The cuts still land on the beats the music was written to. This skill renders by itself;
the export is for a person who finishes the film elsewhere. Remotion needs a company licence for a business of four
or more people — say so when you point someone to it.

## 14. Troubleshooting (known traps)

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
| a recorded sound lands late on its hit | it was placed from its start; a whoosh peaks 0.7 s in | `sample()` places the loudest moment on the cue by default (`align: 'peak'`); `tools/kit.mjs` lists each file's peak |
| `verify` FAILs at some times | a scene keeps state between frames, reads the clock, or rolls `Math.random` | compute everything from `t` (and text from `frame / FPS`); `hash(i, seed)` for randomness |
| `[screen] cannot load assets/footage/…` | the cut was not made, or a source second past its end | `node tools/footage.mjs cut …`; `frame()` clamps inside the cut, a hand-built url does not |
| an empty frame in a footage shot (QA `flash` / `pops`) | an image drawn but not listed in `render.needs(t)` | list every url the frame draws, the echo's too |
| "WebGL2 is not available" | a browser without WebGL2 (an old Chromium, GPU switched off by policy) | Chrome or Edge; headless draws it in software |
| a number shows two values at once in a blurred frame | the counter was computed from the sample time | compute it from `frame / FPS` |
| `ui-shot`: "not clicked: … submits a form" | the target is a submit button, or a plain button inside a form | stage the state another way (`--eval`, `--type` without submitting) |
| `ui-shot`: "blocked N request(s) that would have sent data" | the page tried to post something (a form, a tracker, a beacon); only GET, HEAD and OPTIONS leave the browser | the shot is still right unless the state needed the server's answer — then stage that state with `--eval` |
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
