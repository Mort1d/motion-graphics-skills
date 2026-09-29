# Look cards: nine visual languages

A look is more than a palette: the canvas, the type, the way things move and the texture have to agree, or the video
reads as a template. Left alone, every video comes out in the template's own look (a dark ground, one neon accent,
slams). Pick a card at step 3 from the brand's own surfaces and voice (`direction.md` §4), then change it for this
brand — its colours, its fonts, its shapes. Do not take the card the last video in this folder took.

Timing is in beats: "stagger ⅛" = the next element starts ⅛ beat later; "hold 2" = text stays 2 beats after landing.
Springs are `SPRING` feels in `js/engine.js` (snap, base, heavy, play).

## Contents
1. Product film (light) · 2. Terminal release · 3. Liquid glass · 4. Neon kinetic · 5. Editorial print ·
6. Data story · 7. Playful pop · 8. Cinematic premium · 9. Grid system — and how to pick

## 1. Product film (light)
- **When**: SaaS, apps, tools with a clean light site; launches that sell the product itself.
- **Canvas**: warm white or light grey; a faint tint of the accent behind whatever is in focus. No dark scenes.
- **Type**: a heavy sans for statements (800, tight tracking), one accent word per line in a contrasting face (a
  serif italic) or the accent colour; UI text at the product's own size × the camera zoom.
- **Colour**: the brand accent means one thing (good news, the key word); everything else neutral.
- **Motion**: words rise out of a mask line one per beat; things change shape into the next thing (a dot → a button →
  a card); springs base, snap on UI; stagger ⅛, hold 2.
- **Transitions**: morphs and match moves; almost no hard cuts.
- **Camera**: one camera over the product, following the cursor, zoom in log space.
- **Texture**: real UI crops on white cards — radius, a 1 px border, a soft wide shadow.
- **Sound**: ui-led — clicks, pops, typing tuned to the key over a light 2-step, garage or minimal groove.
- **Banned**: glows, gradients on UI chrome, particles, 3D tilts for their own sake, crossfades, holds over 1½ beats.

## 2. Terminal release
- **When**: developer tools, CLIs, libraries, open source, APIs; a repo is the input.
- **Canvas**: near-black ink, a subtle grid or scanline texture at 3–5 %.
- **Type**: a mono face for captions and code (lowercase statements work: "hot reload. no restart."), one sans or the
  project's wordmark for the name; the accent colour marks one word per caption.
- **Colour**: the project's colour as the single accent (orange, green, violet); syntax colours kept muted.
- **Motion**: typing at a readable rate, decode/scramble for names, panels sliding on snap springs; stagger ¼, hold 2.
- **Transitions**: hard cuts on downbeats, split panes, a caret that becomes the next frame.
- **Camera**: mostly still, with pushes into the output that matters.
- **Texture**: real terminal output, real code from the docs, the install command at the end.
- **Sound**: music-led with the kit clean and tight; key clicks and data blips from the typing schedule.
- **Banned**: neon glow on everything, fake "hacker" matrices, HUD corners, invented commands or output.

## 3. Liquid glass
- **When**: design-forward apps, consumer tech, a brand with soft gradients and rounded UI.
- **Canvas**: a slow pastel gradient field; blurred colour blobs drifting.
- **Type**: a clean sans (600–700), large; words may sit under a glass lens that refracts them.
- **Colour**: pastel ground, white glass, one saturated accent for the active state.
- **Motion**: one glass element morphs into each component (a button, a player, a tab bar, a chart); springs base with
  a hair of overshoot; stagger ⅛, hold 1½.
- **Transitions**: the morph is the transition; never a hard cut.
- **Camera**: still or a very slow drift; the objects move, not the camera.
- **Texture**: frosted glass (blurred, lightened copy of the ground), a specular edge, soft shadows.
- **Sound**: ui-led or music-led: soft plucks, glass bells, an airy groove at 110–125.
- **Banned**: heavy slabs, hard cuts, dark scenes, speed lines.

## 4. Neon kinetic
- **When**: cars, sport, gaming, nightlife, streetwear, energy drinks; a dark brand that wants impact.
- **Canvas**: dark, with light glows and a vignette; depth from blurred colour fields.
- **Type**: a heavy italic or condensed display face, huge (15–30 % of the frame height), one word per slam.
- **Colour**: one neon accent that owns the hits; white type.
- **Motion**: slams with overshoot, whip pans, shakes on hits, speed lines, flashes on the biggest hits only;
  stagger ⅛, hold 1.
- **Transitions**: whips, brand-angle wipes, zoom-throughs, a hole before the reveal.
- **Camera**: alive — pushes, shakes, parallax.
- **Texture**: sparks, streaks, grain.
- **Sound**: music-led and driving: phonk, drum & bass, breakbeat, rock-ish hybrid.
- **Banned** for health, kids, luxury and most B2B — and as the default: it is the template's own look.

## 5. Editorial print
- **When**: food, craft, culture, media, bookshops, anything with a warm or handmade voice.
- **Canvas**: paper or a warm off-white, visible grain; ink black.
- **Type**: a serif display (with italics), a grotesk for labels; big headlines set like a magazine page.
- **Colour**: two inks plus one spot colour; photos keep their own colour.
- **Motion**: cut-paper pieces sliding in, stamps landing, ink strokes drawing; springs heavy; stagger ¼, hold 2.
- **Transitions**: page turns, paper tears, a stamp that fills the frame.
- **Camera**: top-down over a table; small shifts.
- **Texture**: halftone, paper fibres, torn edges, the brand's own photos.
- **Sound**: music-led: funk, boogie, lo-fi, latin, brass; paper and stamp sounds from the brand's world.
- **Banned**: glass, glows, neon, 3D.

## 6. Data story
- **When**: B2B, fintech, logistics, analytics, reports, anything proven by numbers.
- **Canvas**: dark navy or clean white; a fine grid.
- **Type**: a clean sans for words, a mono or tabular figure face for numbers (numbers never jump: they roll).
- **Colour**: neutral charts, one accent for the number that matters, red only for the problem.
- **Motion**: charts drawing, bars rising, counters rolling to real values, routes drawing across a map, split-flap
  boards; springs base; stagger ⅛, hold 2 (numbers need reading time).
- **Transitions**: zoom from the whole chart into the one bar; a line that becomes the next chart's axis.
- **Camera**: slow, deliberate; a push into the key number.
- **Texture**: real data only, each figure with its source in the brief; an illustrative value carries "Example".
- **Sound**: cinematic hybrid or minimal pulse; a tick per digit, a chime when the payoff number lands.
- **Banned**: invented statistics, 3D pie charts, dashboards that exist nowhere.

## 7. Playful pop
- **When**: kids, education, consumer apps, delivery, pets, games, anything friendly and bright.
- **Canvas**: bright flat colours, a colour change per scene.
- **Type**: a rounded bold face; words bounce in.
- **Colour**: 3–4 saturated brand colours, used in blocks.
- **Motion**: squash and stretch, bouncy springs (play), stickers popping, confetti on the payoff; stagger ⅛, hold 1½.
- **Transitions**: a shape that grows to fill the frame in the next colour; bounces.
- **Camera**: bouncy pushes on the hits.
- **Texture**: flat shapes, a thick outline, the mascot if the brand has one.
- **Sound**: ui-led: marimba or pluck pop, a pop per element, boings, a success arpeggio.
- **Banned**: dark grounds, heavy type, glows, aggressive genres.

## 8. Cinematic premium
- **When**: luxury, real estate, jewellery, premium wellness, serious B2B, a founder's film.
- **Canvas**: deep colour or black; or a quiet light stone colour.
- **Type**: a thin or high-contrast serif, generous tracking, small words with a lot of space.
- **Colour**: a restrained palette, metallic or muted accent.
- **Motion**: slow pushes (log zoom), light sweeps, long holds, few moves at a time; springs heavy; stagger ½, hold 3.
- **Transitions**: light streaks, slow dissolves through a shape, match cuts.
- **Camera**: slow and continuous; the frame always breathes.
- **Texture**: film grain, soft light, the product's real photography.
- **Sound**: music-led, low–mid energy: ambient pulse, cinematic hybrid, piano and glass; long tails.
- **Banned**: slams, shakes, flashes, bouncy easing, speed lines.

## 9. Grid system
- **When**: a brand with several products or features to show at once; portfolios; loops for social.
- **Canvas**: a strict 2×2 or 3×3 grid on a neutral ground; gutters as a design element.
- **Type**: a big grotesk, one statement across the grid.
- **Colour**: black and white plus one colour, or each cell in one brand colour.
- **Motion**: every cell a mini-scene moving in sync on the beat; cells swap on downbeats; springs snap; stagger ⅛.
- **Transitions**: cells flipping, the grid collapsing into one cell that fills the frame.
- **Camera**: static; the grid is the camera.
- **Texture**: real product shots per cell.
- **Sound**: music-led, driving and steady (broken beats, garage, jersey club); a hit per cell change.
- **Banned**: slow holds, uneven cells, more than one statement at a time.

## How to pick
1. The brand's surfaces first: a white site → 1, 3, 5 or 7; a dark site → 2, 4, 6 or 8.
2. The voice and the audience second (`direction.md` §4): developers → 2 or 1; kids → 7; luxury → 8; food → 5.
3. The direction's energy third: calm films take 3, 5 or 8 more easily; driving films 1, 2, 4, 7 or 9.
4. Not the card the last video in this folder used (look at its README). Two cards can blend when the brand spans
   both (a fintech app: 1 with the numbers of 6) — one leads.
