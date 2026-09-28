# Story and motion: what makes a promo sell and look like a showreel

## Contents
1. From brief to concept
2. Length and beat sheets
3. The selling arc, scene by scene
4. Motion craft
5. Transitions
6. Type in motion
7. Colour, light, depth
8. Showreel vocabulary (what the trend references do)
9. Anti-generic list
10. Frame quality checklist

## 1. From brief to concept

1. **One promise.** Compress the business into one sentence a viewer repeats: "parts by VIN in 10 minutes",
   "flowers on a subscription, never forget a date". Every scene serves it.
2. **Proof points.** 3–5 facts that make the promise believable: numbers, how it works, real photos, real
   cases, guarantees. Only facts from the brief, the site or the user (brief.md lists the source of each).
3. **The action.** What the viewer does next and where (a bot, a site, a phone). If sales happen in a Telegram bot,
   the CTA and the end card drive to the bot — not to the site.
4. **The brand's visual DNA.** Find the brand's own shape and motion and reuse it everywhere: an angle in the logo
   becomes the wipe (an auto-parts brand's red slash at 23.9° cut every transition); the product's world gives the metaphor
   (a car → ignition, tachometer, sparks; flowers → a bloom; a bot → a chat; a marketplace → a cart filling up).
5. **One signature moment.** The shot people remember: a logo that lights up like headlights, a wall of real
   orders bursting out of a parcel, a split-flap board spelling the offer. Plan it first; build toward it.

## 2. Length and beat sheets

Choose the length from the content, not from a number in the prompt. A "15-second showreel" prompt that also asks
for a selling promo → make the promo at the length its facts need (usually 30–45 s) and offer a 15 s cutdown
(`tools/cutdown.mjs`). One bar = 240 / BPM seconds (at 120 BPM: 2 s; at 128: 1.875 s).

| Length | Bars at 120–130 BPM | Shape |
|---|---|---|
| 15 s | 8 | hook (1) · reveal (1) · 2 proof beats (3) · lockup + CTA (3) |
| 30 s | 16 | hook (2) · reveal (2) · proof ×3 (6) · offer (2) · lockup (4) |
| 45 s | 24 | hook (2–4) · reveal (2) · how it works (6) · proof / cases (6) · offer (2) · lockup (4) |
| 60 s | 32 | as 45 s + a second act (a breakdown and a second drop) — only if there is enough to say |

Write the direction in the README — a table (beats | shot | enters → leaves | sound) plus the palette roles, the type,
the banned list and the sound cue list — then encode it in `js/timeline.mjs`: scene
windows `S` (neighbours overlap by up to a beat — that is where transitions live), named `CUE`s (every slam, reveal,
card, drop), `WHIPS` (fast moves → 16 blur samples), `COVERS` (thumbnail times), `DURATION` (last hit + 1.5–2.5 s — under a fixed length, place the last hit that far before the end, so the
tail fits).

**A worked direction** — for a made-up brand, Loafly (loafly.example, a bakery-delivery app), 30 s at 132 BPM. It
shows the level of detail to reach before building, not a style or a genre to reuse: yours come from your brand, its
references and `sound-print --suggest`.

| Beats | Shot | Enters → leaves | Sound |
|---|---|---|---|
| 0–4 | "Warm bread at 7:00." — one word per beat, black 900 on a crust-coloured gradient | each word drops in with a 3-frame overshoot → the last one smears sideways into the next shot | shaker from frame 1, a crust crackle per word |
| 4–12 | the logo's loaf rises like dough (scale Y 0.2 → 1 with a soft wobble), the wordmark types in | rises from the bottom edge on the drop → the loaf's outline becomes the frame of the first app card (match cut) | the drop: the full 2-step groove; the 3-note sonic logo |
| 12–32 | the real app screens (`brand/sections/`) tilted in 3D; each tap ripples | a whip in from the right on beat 1 of each bar → an accelerating exit left | a tick per tap from the same schedule; an oven door on the third card |
| 32–48 | "38 bakeries" rolls up (a number from the site) as pins pop onto a city map | pins pop on the off-beats → a zoom into one pin with a blur ramp | pin pops on the hats' off-beats; a bell as the count lands |
| 48–60 | lockup: logo, "Order in the app", loafly.example — held 3 s | cut 2 frames before the last downbeat → holds with a slow push | a beat of silence, the sonic logo, a reverb tail |

Palette as roles: page #FFF8EE, surface #F2E3CC, ink #2B1A10, accent #E4572E — the accent marks only the key word
of each line. Type: the site's display face at 900 for statements (120–160 px), its text face at 500 for UI labels
(≥ 28 px). Hard cuts on beats 4, 32 and 48; everything else is a match cut or a whip. Banned here: cross-fades, a logo
on black first, a scene counter, stock bread photos, HUD corners, emoji, a kick on every beat. Sound brief — not `--suggest`'s first
card (lo-fi at 78 BPM), because the brief asked for energy and the references cut fast: UK garage 2-step, 132 BPM,
D♭ major, shuffled hats, organ stabs, a subby kick; brand-world sounds — crust crackle, oven door, paper bag; −14 LUFS.

**The pace in numbers.** The motion references this skill was measured on move in 75–90 % of their frames, land 55–80
visual hits a minute, and put most of them on the beat (or at one constant offset — cuts a frame or two early on
purpose). Measure your draft the same way: `ref-sheet.mjs out/<slug>-draft.mp4 --bpm <BPM>`. A calm film may sit
lower on hits; a still frame outside the end card is a bug in any film.

## 3. The selling arc, scene by scene

- **Hook (0–3 s)**: the promise or the pain in 3–6 words, with motion from frame 1 — never a logo on black first.
- **Reveal**: the brand arrives with the drop; the logo does something only it can do.
- **How it works**: 2–4 steps shown, not told — UI in motion, the product in use, a map, a timer.
- **Proof**: numbers that roll, real photos (the client's), cases, guarantees. Faces and names only if the client
  gave them for this purpose.
- **Offer**: what is special now (only if real: a price from the site, a free consultation, a delivery promise).
- **Lockup + CTA**: logo, one-line CTA, contacts large and readable, held ≥ 2.5 s; the sonic logo plays.

## 4. Motion craft

- **Easing vocabulary.** Entrances: `outExpo` / `outCubic` (fast, settles). Exits: `inExpo` (accelerates away).
  Wipes: `inOutSine` over ≥ 0.3 s (a faster wipe reads as a flash cut). UI and bouncy things: `outBack`,
  `spring()`. Linear only for continuous motion (drift, parallax, rotation).
- **Anticipation and overshoot.** A slam scales from ~1.7 to 1 with a small overshoot (`slam()`); a whip starts slow
  and ends fast; nothing starts and stops at full speed.
- **Stagger.** Groups enter one by one, 1/8–1/4 beat apart, in reading order; never all at once.
- **The beat is the clock.** Hard cuts, slams and reveals land ON beats (CUEs are beats). Secondary motion can sit on
  8ths and 16ths. A hard cut may lead its beat by a frame or two: light arrives before sound, and editors cut early
  so the cut feels like the hit.
- **Cut on motion.** Every shot enters already moving (a fast ease-out that is still travelling on its first frame)
  and leaves on an accelerating move, a whip or a blur ramp. Two still frames on either side of a cut read as a
  slideshow; one planned hold per video is plenty.
- **The camera is alive.** A slow push (2–6 %) through every hold, a shake on hits (`shake`, 10–25 px, 0.3–0.5 s),
  parallax between layers. A frozen frame reads as a slide.
- **Motion blur sells speed.** Every fast move gets 16 samples (`WHIPS`) and speed lines; don't fake blur with CSS
  filters.
- **Depth.** 3–4 layers (background glow, midground, hero, foreground particles), each moving at its own speed; light
  blobs and vignette for focus.
- **Flashes and shakes are spice.** A 0.1-s white flash at 10–40 % on the biggest hits only.
- **Holds.** Text that must be read holds ≥ 0.6 s per 3 words after it lands; the end card ≥ 2.5 s.

## 5. Transitions

| Transition | How (scene-cookbook.md) | Use for |
|---|---|---|
| Whip pan | `whip()` out + in, 0.3–0.45 s, speed lines, 16 blur samples, a whoosh | energy, next topic |

A whip lasts from its exit cue to the next scene's landing cue (`whip(t, CUE.exit, CUE.land - CUE.exit, …)`, as in
the demo's hook). Measured to any nearer marker it finishes early and the scene sits off-screen for the rest of its
window — in a still that looks like a broken scene, not a fast transition.
| Brand-shaped wipe | `slashClip()` at the logo's angle, `inOutSine` ≥ 0.3 s | the brand's signature |
| Zoom-through | scale into a letter's counter / a dot / a screen until it fills the frame | reveal the next world |
| Match cut | same shape or position in both scenes, hard cut on the beat | elegance |
| Split-flap / scramble | characters flip / decode into the next words | information, prices, names |
| Card stack | the next scene is a card that slides over, with shadow | UI, steps |
| Light streak | a streak crosses the frame, the scene changes under it | premium, tech |
| Mask reveal | text or logo as a window into the next scene | bold statements |
| Glitch cut | 2–4 frames of offset slices + `glitch` sound | tech, AI |
| Hole | everything freezes and goes silent ½ beat, then the hit | before the biggest reveal |

## 6. Type in motion

- One display face (heavy, italic caps read as speed) + one supporting face (mono for data, a sans for small text).
- Sizes at 1080p: statements 150–260 px, card numbers 120–160 px, labels 28–36 px, never below 26 px (phones).
- 1–4 words per slam; a line per beat. Split long sentences into beats.
- Numbers roll (`roll()`), never jump; units in a contrasting style.
- Measure text after fonts load (they are, in main.js) and `fitFont()` anything that could overflow — especially in
  other languages.

## 7. Colour, light, depth

- **Light or dark comes from the brand**, not from the template: look at the brand's own surfaces (site background,
  the logo's ground, packaging, the bot's avatar). A white site, kids, food, flowers, health, most retail → a light
  video; cars, gaming, nightlife, developer tools → dark. `css/style.css` has a light preset — swap it in first. Left
  alone, every video comes out dark with one neon accent (the template's look): three different briefs, one look.
- 4–6 colours from the brand (`scripts/palette.mjs` on the logo / screenshots), one accent that owns the hits.
- **Scale**: the hero owns the frame — a key word at 15–30 % of the frame height, a UI card or a product at 50–80 %
  of the width, cropped by the frame edge when it moves (that is energy, not a mistake). A small card floating in
  the middle of an empty frame reads as a slide.
- **Layers**: a background that lives (a slow brand shape or pattern, large blurred colour fields, a grid, paper,
  grain), a midground hero, a foreground accent (particles, a line that draws, a sticker) — each at its own speed.
- **No photos? Draw the world.** SVG and canvas can draw the product's objects at hero size: beans, a cup and
  steam; pencils, paper and scribbles; a server rack and a pulse line. One drawn signature element per brand (the
  pencil line that draws every transition) makes the video this brand's.
- Dark grounds make light effects glow; light grounds need shadows and depth to avoid a flat slide. On white, a white
  element needs a 1-px edge and a faint shadow, or it vanishes.
- Frosted glass that reads on any ground: a blurred, lightened copy of what is behind, clipped to the shape (letters
  included — giant glass titles over a photo).
- Glow = the accent at 30–60 % in `text-shadow` / `box-shadow`; bloom-like light blobs behind heroes.
- Real client photos keep their colours; unify with a grade (a shared overlay tint at 5–15 %) rather than filters.

## 8. Showreel vocabulary

What trending motion reels (product launches, "made with code" reels) do — recreate techniques, never footage:
- **Product UI in motion**: toolbars, cursors that click, panels that slide, typing, a 3D tilt of the screen.
- **Glass**: frosted cards (`backdrop-filter: blur()`, a light border, a specular gradient), refraction via an SVG
  displacement filter on still layers.
- **Grids**: 2×2 or 3×3 panels moving in sync, each a mini scene.
- **Kinetic type**: one word per beat, huge, slamming, with shakes; decoding text; split-flap boards.
- **Counters and maps**: odometers and rolling prices of real facts, routes drawing across a map with stops
  lighting up — a number on screen is always a fact about the brand, never an index of the video.
- **Photo walls**: real photos flying into a 3D wall (CSS perspective), cards fanning out.
- **Particles**: sparks from a grinder, confetti, dust, light streaks — canvas, deterministic.
- **Logo moments**: traced logo letters slam one by one, a cut sweeps through with sparks, headlights ignite,
  a shockwave ring.

## 9. Anti-generic list

These make a promo look cheap or AI-made — avoid unless the brand really calls for them:
- centred text fading in and out on a gradient (a slideshow); a logo alone on black as the first frame;
- the template's look for every brand: a dark ground, one neon accent, small cards floating in empty space;
- everything easing the same way, everything moving at once, linear motion;
- stock-looking icons, emoji, rainbow gradients, neon on everything, lens-flare spam;
- default system fonts, more than two typefaces, text under 26 px;
- **a scene counter or chapter label** — "01 / 06", "02/06", "SCENE 03", "CH. 2", "step 1 of 4" in a corner, a row of
  progress dots. Every model adds one to look "designed", and viewers read it as a template: it numbers the edit
  instead of selling the brand. No exceptions — the video never numbers its own scenes. `main.js` warns about one in
  the capture log and `qa.mjs` fails it;
- HUD overlays (timecodes, frame counters, BPM readouts, corner brackets, "REC", coordinates) — unless the brand's
  world is literally a HUD;
- invented numbers, fake reviews, fake client logos;
- a generic "corporate" music bed; the same track as the last video.

## 10. Frame quality checklist

Before the final render, from the contact sheet and stills at every CUE (± 0.1 s around each transition):
- the look is the brand's (a light brand is a light video); in most frames the hero fills the frame;
- nothing cut off at the edges; text readable at phone size; no text on busy photos without a scrim;
- no empty (all-background) frames except intended holds; no scene covering the one before too early;
- the accent colour marks the key word of every statement;
- every transition has motion in both scenes (no dead frames in the overlap);
- the end card is balanced, the CTA and contacts are the largest things after the logo.
