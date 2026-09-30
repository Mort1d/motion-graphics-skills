# Direction: from what the person gave to the film in one line

Read this at step 3, whole. The quality of the video is decided here, before a line of scene code: a clear direction
turns into a good plan, a vague one into a generic reel that no check can rescue.

## Contents
1. Read everything, in this order
2. What the input is → what the hero is
3. Where it plays → the opening, the sound, the format
4. The brand's own voice
5. Energy, mood and the sound's role
6. Three concepts, one film
7. The direction card
8. Worked directions (eight briefs)
9. Brief contagion: the defaults every model reaches for

## 1. Read everything, in this order

1. **The person's words** win over everything below, in any language: how it should feel ("dynamic", "calm",
   "like Apple"), a genre ("phonk", "rock"), a length, a format, where it will run, what to show. Quote them in the
   direction card — words in another language with their English gloss in quotes after them — and the plan and the
   checks hold the video to them (`tools/plan-check.mjs` reads the Energy line, in English).
2. **What they gave** (§2): a site, a repository, an app, screenshots, a recording, photos, a logo, only a name.
3. **Where it plays** (§3), said or implied: a release post on X, Reels, a site header, a pitch.
4. **The brand's voice** (§4): how its copy talks, its colours and type, how its own interface moves, who it serves.
5. **References**, when given: their pace, their music arc and their techniques (`ref-sheet.mjs`, step 2). None
   given: the two closest patterns in `wow-library.md` set the bar.
6. **The topic** last: a car parts shop and a clinic differ, but two clinics differ too — the topic alone makes every
   brand of a kind look the same.

Write what you read in one line per signal before deciding anything; a direction is only as good as what it read.

## 2. What the input is → what the hero is

The best videos make the real thing the hero: the product's own interface, its own data, its own words. Invented UI,
invented numbers and a logo redrawn from memory read as fake at once.

| Given | The hero | Take from it | Watch out |
|---|---|---|---|
| A site | its UI and its promise | `site-kit.mjs`: colours, fonts, logo, sections; `ui-shot.mjs` for single elements (a card, a button, a chart) on a transparent ground | the site's cookie banner and chat bubble are not the brand |
| A GitHub repository | the tool at work: the terminal, the code, the output, the diff | the README's promise and feature list, the install command, a real example from the docs, release notes; numbers only as the page states them (stars, contributors, commits) | GitHub's own interface is not the brand — take the project's logo, colours and wording; a repo with no brand gets a look chosen for its audience (`look-cards.md`) |
| A service or an app | a flow the viewer recognises: a tap, a result, a number going the right way | real screens (site-kit sections, ui-shot, the user's screenshots); the one action that shows the value | never draw a screen that does not exist; a state the screenshots lack is staged on the page copy (`ui-shot --eval`) and said in the report |
| Screenshots only | the UI in them, animated | crops at 2×, the palette from them (`palette.mjs`) | personal data in them never reaches the video |
| A screen recording | the product at work, zoomed to where it happens | `footage.mjs scan`: where the picture changes, second by second — the camera's targets | shown whole it is unreadable on a phone (`footage.md` §10) |
| Photos or the person's footage | the people, the places, the product in real light | `footage.mjs scan`: the shots, the liveliest seconds, the camera's direction, the light; colours; the story they tell | faces only with consent; a photo is a hero, not wallpaper (`footage.md`) |
| A logo or only a name | a world built around the mark | its shapes, angles, letters (`trace-logo.mjs`) as the transition language | "no material" is not "no idea": draw the world (`story-and-motion.md` §7) |
| A Telegram bot or channel | the chat: messages, buttons, the answer that arrives | the avatar and description (site-kit on the t.me link) | the CTA drives to the bot, not to a site |

## 3. Where it plays → the opening, the sound, the format

Every platform's own guidance says the same about the opening: motion and a readable claim in the first second or
two. None of them recommends a calm opening that builds later.

| Placement | Format | Opening | Sound | Length |
|---|---|---|---|---|
| Reels, TikTok, Shorts, Stories | 9:16 | a claim in 3–6 words, moving from frame 1 | on: the groove from the first bar | 10–30 s |
| X, YouTube, Telegram, a site's video section | 16:9 | as above; X loops short videos, so the end can fold into the start | on | 10–45 s |
| Feeds that start muted (Facebook, Instagram feed, LinkedIn) | 1:1, 4:5, 16:9 | the words carry the story on their own; the first frame is the thumbnail | a bonus: the picture must work without it | 10–30 s |
| A site's hero loop, a background | 16:9 or the slot's shape | calm, never competing with the headline; loops seamlessly (`LOOP`) | none, or a quiet bed the page may never play | 8–20 s |
| A pitch, a presentation, an event screen | 16:9 | clear, readable from across a room | often silent: the type must be self-sufficient | 20–60 s |

A placement nobody named: a promo for a business is posted where people scroll — plan for sound on, a hook in the
first second, and a first frame that works as a thumbnail.

## 4. The brand's own voice

- **Copy**: short and playful, precise and technical, warm and human, formal and reassuring, luxurious and sparse.
  The on-screen words keep that voice; the motion follows it (playful copy → bouncy springs, sparse copy → holds).
- **Colours and type**: a white site is a light video; heavy grotesk and saturated colour → hard, graphic motion;
  thin serif and muted colour → slow, spacious motion. The look card in `look-cards.md` is picked from these.
- **Its own interface**: how its buttons, menus and pages move is the brand's motion already — match its speed and
  its easing, and the video feels like the product.
- **Audience**: developers read clean and precise as competent (not as calm); kids and consumer apps read bouncy and
  bright; business buyers read confident and clear; luxury reads slow and spacious.

## 5. Energy, mood and the sound's role

**Energy** (how hard it hits, per scene: `ENERGY` in `js/timeline.mjs`). Motion graphics is a genre of movement, and
most people who ask for a promo want it to drive. The default for a promo, a launch, a reel or an ad is the groove from
the first bar (a pickup of a bar at most), energy held through every scene, contrast made by adding (a new layer, a
fill, a hole before the biggest hit) rather than by thinning. The seven references this skill is measured on all
drive from their first seconds.

Calm needs a reason, written in the card: the person asked for it; the brand lives in calm (a spa, a clinic, a
luxury house, a memorial, a meditation app); the placement is a background or a hero loop; the subject is sensitive.
Even a calm film moves from frame 1 — slower, softer, never still.

**Mood** is a separate axis from energy: bright or dark, warm or cool, playful or serious. A driving video can be
bright and playful (a kids' app) or dark and serious (a security tool). Mood picks the key, the harmony and the kit;
energy picks how much of the groove plays.

**The sound's role**:
- **music-led** — the track carries the film and the cuts ride it: kinetic type, brand films, footage, reels. Sound
  effects mark the big hits and the transitions.
- **ui-led** — every visible interface event has its own sound, tuned to the key: taps, toggles, typing, pops, a
  success chime; the music is a lighter groove underneath, 3–6 dB lower than in a music-led mix. Services, apps and
  product demos, where the product is the hero: the viewer hears it working.
- A voice-over (the person's recording) leads when there is one: the picture and the music are timed to it.

## 6. Three concepts, one film

A concept is one sustained device that carries the whole film, plus one signature moment the viewer remembers. The
strongest videos use one device from start to end; a montage of unrelated effects reads as a template.

Write three concepts in two lines each — the device, the signature moment, the structure — as different from each
other as the brief allows. Devices that work (breakdowns in `wow-library.md`):
- one shape that never cuts: a dot grows into a button, the button into a card, the card into the next screen;
- a smart camera over the real product that follows the cursor and zooms where the work happens;
- the terminal as a stage: typed statements, real output, the release in its own medium;
- kinetic statements, one word per beat, each triad paying off a claim (three steps of the product's own process);
- a grid of synchronised mini-scenes, looping;
- one layout recoloured per mode, theme or genre;
- the brand's own shape as the transition language (a slash, a curve, a letter);
- a real number counting to its payoff on the drop;
- a known film's grammar rebuilt with this brand (only when the person names it).

Score each 1–5 on: says the promise; the hero is the real product or material; the signature moment is memorable;
it can be built well in code in this session; it is not what the last video in this folder did. Take the highest;
write the other two in one line each in the card (a reviewer sees the choice was made).

## 7. The direction card

Written into the project README (the template has the fields) before any scene code, then checked with
`node tools/plan-check.mjs` once `js/timeline.mjs` holds the plan:

- **Film in one line**: what the viewer feels and does at the end.
- **Read from**: the person's words (quoted), what they gave, where it plays, the brand's voice.
- **Concept**: the device and the signature moment; the two concepts not taken, one line each.
- **Look**: a card from `look-cards.md` and this brand's changes to it; palette roles with hexes; type with sizes.
- **Energy**: per scene, and where it came from ("dynamic, punchy" → high from bar 1).
- **Sound role**: music-led or ui-led, and the genre card that fits both the energy and the mood.
- **Beat map**: the story table (beats → shot → how it enters and leaves → sound).
- **Banned**: the anti-generic list (`story-and-motion.md` §9) plus what this brand rules out.

A person who pasted a detailed direction of their own gets it to the frame; the card fills only what they left open.

## 8. Worked directions

Made-up briefs, to show how different inputs lead to different films — the reasoning to copy, not the answers.

1. **A GitHub repo of a CLI tool, "a release video, lots of energy".** Words: energy → high from bar 1.
   Input: a repo → the terminal is the hero; the README's three headline features. Placement: X → 16:9, sound on,
   25–35 s. Voice: developers → clean and precise, not noisy. Concept: *terminal as a stage* — each feature a typed
   statement under real output; signature: the install command types itself and the whole screen assembles around it.
   Look: terminal release. Sound: music-led, a driving breakbeat or UK garage at 125–135 with key clicks in the kit.
2. **A SaaS invoicing site, no words about the feel.** No energy words → the promo default: drive from bar 1,
   bright mood. Input: real dashboard sections + ui-shot of the invoice card and the "Paid" badge. Concept: *one shape
   never cuts* — a dot → the New-invoice button → the invoice card → a "Sent" pill → the paid badge; signature: the
   total counts to £0.00 on the drop. Look: product film (light). Sound: ui-led — every click and pop tuned, a light
   2-step underneath.
3. **A spa's site, no words.** The brand lives in calm → low–mid, warm. Input: photos of the rooms, a serif
   wordmark. Concept: slow pushes through three photos with the words rising out of a mask line; signature: the
   wordmark draws itself like steam. Look: cinematic premium, light variant. Sound: music-led, ambient pulse, long
   tails; motion from frame 1, just slow.
4. **A kids' learning app, screenshots, "for TikTok".** Placement: 9:16, 15–20 s, sound on. Voice: playful.
   Energy: high, bright. Concept: the app's mascot and lesson cards bounce in on the beat, each tap pops; signature:
   a lesson card flips into a medal. Look: playful pop. Sound: ui-led, marimba pop, a pop per card.
5. **A logistics company, "calm, premium", for a pitch.** Words: calm, premium → mid at most. Placement: a
   presentation → silent-safe type. Concept: *data story* — a route draws across a map, real volumes roll; signature:
   the network lights up city by city. Look: data story, dark. Sound: minimal pulse, a tick per digit.
6. **A fitness tracker's launch, a product page and app screenshots, "make it explosive".** Explosive → high from
   bar 1. Concept: a day told by the tracker's own rings — each stat closes its ring on a beat while the day speeds
   past; signature: every ring snaps shut together on the drop. Look: neon kinetic, from the app's colours. Sound:
   music-led, broken beat, a tick per stat.
7. **A personal travel reel from photos, "fast, with bold transitions".** High. The photos are the heroes. Concept:
   whip pans between photos on every downbeat, the place names slam in, a map route draws between cities;
   signature: a zoom through one photo's window into the next city. Look: from the photos' own colours, grain.
   Sound: music-led, 120–130 BPM, cuts on downbeats (not every beat).
8. **A restaurant opening, a site and a menu, for Reels.** Default drive, warm mood. Concept: the menu's dishes land
   on a table grid one per beat, prices from the site; signature: the doors open on the opening date. Look: editorial
   print. Sound: music-led, funk or latin groove, a pan sizzle as the brand sound.

## 9. Brief contagion: the defaults every model reaches for

Two briefs that ask for the same thing come out alike — not for their ambition, but for everything they leave open.
Left to itself, every model reaches for the same answers: a dark screen with a green or purple glow; a cream canvas with
numbered labels ("01 · CREATE"); centred text fading in on a gradient; frames and text in the corners; an invented
logo; screens that do not exist; beeps "like a microwave"; house at 128 in A minor. The direction above exists to
replace each of these with a choice made for this brand: every line of the card should be something the last video
in this folder did not do.
