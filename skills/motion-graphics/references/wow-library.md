# Wow library: what the videos people save have in common

The level this skill aims for, measured. Read §1 at step 3 and the two patterns closest to your direction card. The
patterns are public videos described in words — their structure and pace, never their footage, words, logos or music.

## Contents
1. The bar in numbers
2. Ten patterns
3. How to use the library

## 1. The bar in numbers

Measured with `ref-sheet.mjs` on the seven motion references this skill is calibrated on, and read from a survey of
over a thousand videos made from code in the same season:
- **The music drives from the first second** in six of seven (the seventh waits two seconds) and never drops out: a
  loudness range of 0.6–4.3 LU across the whole video.
- **Tempo 105–129 BPM**: driving, not frantic.
- **Constant motion**: something moves in 67–100 % of frames; 45–91 visual hits a minute, most on the beat or at one
  constant offset (cuts a frame or two early on purpose).
- **Few hard cuts, often none**: three of seven are one continuous shot carried by morphs and camera moves.
- **The real product is the hero** in six of seven: its interface, its terminal, its app screens.
- **Copy in short parallel statements**, 1–4 words, one accent word — the shape, not these words: "Build.
  Preview. Ship." for a CLI, "Your menu. Your prices. Your guests." for a café.
- **One visual system per video** and one signature moment; real numbers roll; the end is a lockup with the name,
  one line and where to go (a URL, an install command), held.
- The most-saved videos in the survey open already in motion (no establishing shot), carry one device from start to
  end, and are either short (≤ 20 s) or genuinely long; every one of them is locked to its music.

## 2. Ten patterns

**1. One shape, never cut** (a UI morph loop; 14–16 s; 1:1 or 16:9; 120 BPM). A single element changes size, corner
radius, fill and content from state to state — a button, a player, a tab bar, a chart, a search field, a
notification — each change driven by a cursor click or the beat; the last frame is the first, so it loops. Text is
three words at most. Build: `scene-cookbook.md` §22 (`track()` springs, `ui-shot` crops). Fits: apps, design systems,
any product with several interface moments.

**2. The pipeline in four words** (an infrastructure platform's launch; 15 s; 129 BPM; dark). A point of light; three
claims slam one per beat; the install command types; the logo assembles from pixels; a live pipeline graph with a
running timer, one word per stage ("Pushed. Built. Deployed. Live."); a count rolls up beside a sphere of app icons; a
globe with arcs; two benefit flashes (one a split-flap board); an inverted frame; the lockup. A two-second intro, then
the groove to the end; 76 hits a minute. Fits: developer platforms, infrastructure, any product with a process.

**3. The terminal as a stage** (a command-line tool's major release; 48 s; 112 BPM). The prompt types the tool's name;
the logo decodes; each feature is a lowercase caption typed at the bottom — "steer it now. or queue it for later." —
over the real interface doing exactly that, one accent word per caption; it ends on the rewrite story, real
repository numbers decoding, and the install command. The groove plays from the first second; 45 hits a minute leave
time to read. Build: §6 typing, §4 decode. Fits: CLIs, libraries, open source, APIs.

**4. The 2×2 grid** (an app's loop; 10 s; 105 BPM). Four synchronised mini-scenes — the phone, a claim, a jackpot
number rolling, a 3D product burst — swap on downbeats; every frame moves. Fits: consumer apps with several hooks,
social ads. Build: §15.

**5. One layout, every mode** (a music app's promo; 24 s; 117 BPM). The same card recoloured per genre, each genre with
its own palette; "One timeline. Any song."; kinetic triads; a 3D bar city on the beat; the app icon; "Drop a song.
Watch it move." 91 hits a minute. Fits: products with modes, themes, templates, personalisation.

**6. The smart-camera demo** (a screen-capture tool's launch; 58 s; 129 BPM; light, Apple-like). A glass toolbar on a
blurred wallpaper; short phrases with one blue word ("When you're done / Share with a link"); a cursor does real
actions while the camera zooms to where the work happens; the result lands in a chat; a pixel dissolve into the
logo; a two-line promise. Build: §23 (`camera()`, log zoom). Fits: SaaS, tools, any flow of actions.

**7. The kinetic hook** (the first 4–6 s of many launch films). Words rise out of a mask line, one per beat, the key
word in the accent face; the stack slides up for the second line; real rows of data stack under it, one per beat,
each with a click; everything squeezes into one dot that becomes the next scene. Build: §24 (`rise()`). Fits: every
promo — the promise or the pain in 3–6 words.

**8. The proof number** (the moment people screenshot). A real total, huge; the real rows land one per two beats,
each with a check, each taking its exact amount off; it lands on the payoff (£0.00, 100 %, "Live") on the drop;
the line rises under it. The arithmetic is checked before animating and every frame shows a real value. Build: §25.
Fits: fintech, invoicing, savings, performance, anything measurable.

**9. The loop end card** (X loops short videos). A dot springs into the logo mark; the wordmark wipes out from behind
it; the line rises; the CTA pops and the cursor clicks it; everything folds back into the dot — the last frame is the
first, the cursor included. Build: §26, `LOOP = true` in `js/timeline.mjs`; QA checks the seam.

**10. The reference remake** (a launch film everyone knows, rebuilt shot by shot for another brand, shown side by
side). The grammar carries over — timing, transitions, framing, camera — the footage, words and logo never do. Only
when the person asks for it ("like this video"): SKILL.md step 2.

## 3. How to use the library

- **No references from the person**: pick the two patterns closest to your direction card; take their numbers (pace,
  tempo, how early the groove plays) as the bar and their structure as a starting point. The concept is still this
  brand's (`direction.md` §6) — two briefs of the same kind should not come out as the same pattern.
- **References given**: analyse them (`ref-sheet.mjs`); they outrank this library.
- **Measure the draft**: `node <skill>/scripts/ref-sheet.mjs out/<slug>-draft.mp4 --bpm <BPM>` — moving share, hits a
  minute and the on-beat share should sit in the ranges above for a driving film; a calm film sits lower on hits, but
  a still frame outside the end card is a bug in any film.
