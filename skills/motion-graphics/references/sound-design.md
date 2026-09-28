# Sound design: an original score for every video

The picture is half of a promo. The other half is a track that belongs to this brand and this edit — never a generic
bed that could sit under any video. This file is how to choose it, write it, and check it without ears.

## Contents
1. Working without ears
2. The sound brief (write it before any code)
3. Choosing the sound: brand × audience × pace of the edit
4. When the user names a sound (or brings a track)
5. The energy map: arrangement follows the story
6. The hook and the sonic logo
7. Brand-world sounds: the signature of each video
8. The SFX map: every visible event gets a decision
9. Mixing
10. Loudness
11. Checking: report, audio-check, the spectrogram
12. Never the same twice: the fingerprint check and what to change

## 1. Working without ears

You cannot listen to what you make, so every decision rests on four legs:
- **Structure you know works**: genre patterns (genre-cards.md), progressions, arrangement conventions.
- **Calibrated voices**: at `vel: 1` every synth voice sits in a known range (one-shots peak near 0 dB, a 4-note pad
  ≈ -17 dB RMS, a lead ≈ -12 dB RMS, a bass ≈ -6 dB RMS); bus defaults set a sane balance. Change levels by bus gain
  and `vel`, in dB steps you can reason about.
- **Numbers**: `node audio/score.mjs --report` (per-bus level per scene) and `node tools/audio-check.mjs` (loudness,
  true peak, band balance, energy per scene).
- **Pictures**: `out/qa/music-audio.png` — spectrogram over waveform with every cue drawn as a line. Open it and read it
  (section 11). If the user can listen, ask them to check the draft: their ears beat every metric.

## 2. The sound brief

Write this into the project README before touching `audio/score.mjs`. It forces real choices instead of defaults.

```
Sound brief
- Feel / genre:   <genre> — because <brand personality, audience, pace of the edit>
- Tempo & key:    <BPM> (one bar = 240 / BPM s), <root> <mode> — chosen, not A minor by habit
- Groove:         <family: four on the floor | backbeat | half-time | broken | no kick> — why this one;
                  kick <16 steps>, snare/clap <16 steps>, hats <16 steps>, straight or swung
- Kit:            kick <type, tune Hz, decay>, snare <type, tone, bright>, hats <metal, tone>, drums bus <colour>
- Percussion:     <conga, shaker, clave, toms… or none>
- Bass:           <voice> — <pattern / relationship to the kick>
- Harmony:        <progression> — <mood it gives>
- Hook:           <voice>, motif <notes, rhythm> — where it plays (always on the logo)
- Brand world:    <2–4 sounds from the product's world> — where each lands
- Energy map:     <scene → intro / build / drop / break / outro, what enters and leaves>
- Transitions:    <risers, holes, tape stops, reverse cymbals — at which cues>
- Mix:            <LUFS target>, reverb <room|hall|plate|huge|dark>, what ducks under what
- Not like the last one because: <genre / tempo / key / kit / lead that differ>
```

## 3. Choosing the sound

Choose in this order — groove family, genre, tempo, key, kit — because a listener recognises a track by its groove
first and its chords last.

**First, look at what already exists.** List the promos in the folder where this project lives (and any folder the
user keeps promos in): `node tools/sound-print.mjs --list <folder>` prints each one's tempo, key and groove. Pick a
family and a genre none of them used. `node tools/sound-print.mjs --suggest "<brand>" --world <row> --in <folder>`
does both steps below for you: it orders the brand row's cards (the table further down) by the brand's name — the
same brand always gets the same start, different brands of one kind get different ones — puts four on the floor last
outside nightlife, moves the families, keys and tempos the folder already has to the back, and proposes a tempo, a key
and a kit character for each. It is a start, not a verdict: the user's words, the references and the edit win.

**The groove family.** Every video picks one on purpose:

| Family | The low end | Genres (card) | Feels |
|---|---|---|---|
| Four on the floor | a kick — or a bass note — on every beat (the fingerprint hears kick and bass together, as a listener does) | house 3, deep house 4, nu-disco 5, afro house 9, corporate 4/4 14 | club, drive — and what almost every generated promo already is |
| Backbeat | kick on 1 and 3 with pickups, snare on 2 and 4 | funk / boogie 5, lo-fi 8, kids pop 15, rock-ish 18, synthwave 7 | human, groovy, warm |
| Half-time | kick on 1, snare on 3, fast hats over a slow body | trap 2, future bass 6, phonk 1, hyperpop 22, cinematic 13 | big, modern, heavy |
| Broken | syncopated kicks off the grid | breakbeat 19, UK garage 12, drum & bass 11, jersey club 20, baile funk 21 | fast, nervous, street, young |
| No kick | ticks, plucks, a heartbeat, swells | luxury ambient 17, cinematic pulse 13, minimal pulse 14 without its kick | calm, premium, precise |

**Four on the floor is the trap.** Asked for "dynamic, more energy" — and shown a showreel at 128 BPM — every model
reaches for it: house at 128, or its neighbours nu-disco at 116 and corporate 4/4 at 110, for a coffee shop, a
school and a garage alike. That is how one person's promos ended up "about the same everywhere", and in this skill's
own test runs "not house at 128" alone only moved the videos to nu-disco at 116. Energy is not a genre: take four on
the floor only for a brand that lives in clubs or when the user asks for it — everything else starts in another row.
A reference sets the energy and the pace of the cuts, never the genre or the tempo of your score.

Then the genre from the brand — the first options of each row are outside four on the floor:

| Brand world / vibe | Genres to consider (BPM) |
|---|---|
| Cars, moto, tuning, gyms, streetwear, energy, gaming — aggressive | drift phonk (128–145), trap (140 half-time), drum & bass (174), rock-ish hybrid (130–150) |
| Tech, SaaS, AI, fintech — clean, smart | minimal pulse, half-time or no kick (90–110), glitch-pop, UK garage (132), liquid drum & bass (174); tech house (4/4) |
| Apps, delivery, marketplaces, e-commerce — friendly, fast | future bass (140–150 half-time), breakbeat (125–135), UK garage (132), jersey club (140); house / nu-disco (4/4) |
| Food, cafés, bakeries, coffee — warm, cozy | lo-fi hip-hop (75–90, swing), funk / boogie with a backbeat (95–112), bossa / latin groove (clave, conga); nu-disco (4/4) |
| Beauty, fashion, flowers, jewellery — elegant | luxury ambient (60–95), amapiano log drums (112–118, the kick drops beats), UK garage (132); deep house (4/4) |
| Kids, education, family, pets — playful | marimba / kalimba pop with a backbeat (100–125), chiptune (120–150), a bouncy breakbeat with toy sounds |
| B2B, industry, logistics, real estate, finance — serious, confident | cinematic hybrid (braams, pulses; 80–100 or 120 half-time), minimal pulse |
| Health, clinics, spa, wellness — calm, trust | ambient pulse (70–90), soft piano + glass pads, gentle plucks |
| Events, bars, nightlife | house / techno (4/4, 122–130), UK garage (130–134), jersey club (140) |
| Regional flavour | latin / dembow (90–100), afro (100–118), East Asian pentatonic plucks (koto = `pluck` 'ks') |

Then let the **edit** decide the details: cuts on every beat and whip pans → 120+ BPM, busy hats, short sounds; long
holds, slow camera, luxury → 70–100 BPM or half-time, space, long reverbs. The hook scene sets the first impression —
the first 2 seconds of sound must already say "this brand".

**The key.** Left alone, models write in A minor (or C major) every time. Choose it: darker F, B♭ or C♯ minor; warm
E♭ or B♭ major (brass sits well there); bright D or E major; funky D or E dorian. Never the key of the last promo.

**The kit is half of the timbre.** The same `kick()` defaults in every video sound like the same video. Give each
one a character (all of these are options of the drum voices, synth-api.md §3):

| Character | Kick | Snare / clap | Hats | Drums bus |
|---|---|---|---|---|
| Clean, precise (tech, SaaS, fintech) | 'tight', `click` 0.6 | `snap`, or 'tight' with `bright` 3500 | `metal` 0.9, `tone` 1.2, short | dry |
| Warm, round (food, cafés, kids) | 'soft', `decay` 0.18 | `rim`, or 'lofi' | `metal` 0.2, `tone` 0.85 | `lp` 9000, room |
| Dusty (lo-fi, vintage, craft) | 'soft', `drive` 1.2 | 'lofi' | `metal` 0, swung | `crush: { bits: 10, rate: 2 }`, `lp` 7000 |
| Hard, loud (sport, auto, street) | 'hard', or '808' with `drive` 4 | 'fat', `snap` 1.6 | `metal` 0.8 | `drive` 3 |
| Big, cinematic (launches, B2B) | 'boom', `decay` 0.9 | 'gated', or `clap` in a hall | few or none | hall reverb |
| Bouncy club (nightlife) | 'punch', `len` 0.35 | `clap`, wide `spread` | open hats on off-beats, `decay` 0.1 | pump the rest |

Tune the kick to the key: `tune` = the root in octave 1 (`hz('F1')` ≈ 43.7 Hz); roots C to E♭ sit under 40 Hz there,
so use their fifth (key of D → `hz('A1')` = 55 Hz). A tuned kick and bass sound like one instrument.

## 4. When the user names a sound (or brings a track)

- **Mood words → parameters.** "aggressive / hard / street" → distorted 808, hard kick, phonk or trap, -12 LUFS;
  "expensive / premium" → sparse, deep, wide reverb, piano / glass, slow; "fun / light" → major key, bouncy bass,
  plucks, claps; "techy / futuristic" → glitch, arps, FM plucks, clean kick; "epic" → cinematic hybrid.
- **"Like the reference".** Run `scripts/ref-sheet.mjs` on the reference to get its tempo, loudness and how its cuts
  sit on the beat; describe its instrumentation in words from what you can see and infer; then write an ORIGINAL piece
  with that energy. Never copy a melody, a hook or a recognisable riff.
- **"Like <artist>".** Translate to traits (tempo, kit, bass, harmony, texture) and write something new in that
  world. Never imitate a specific song.
- **Their own licensed track.** Do not compose; run `ref-sheet.mjs` on it for BPM and the first beat, build
  `js/timeline.mjs` on that grid (set BPM, shift cues by the first-beat offset), and still design the SFX with the
  synth, mixed under their track (`render.mjs --audio <mix.wav>` after you mix both, or mux theirs as is).

## 5. The energy map

The track follows the story, scene by scene (bars = 240 / BPM seconds each; plan scenes in whole bars):

| Part | Where | What happens |
|---|---|---|
| Intro / hook | first 2–8 bars, the hook | no or filtered drums (`automate(bus, 'lp', …)` opening), hits on the words, a pad or a riff hinting the hook |
| Build | into the first reveal | riser, snare/hat roll (`roll()`), filter opening, a reverse cymbal ending on the reveal |
| Hole | ⅛–½ beat before the biggest hits | `gap()` — silence makes the next hit twice as big |
| Drop 1 | the brand reveal / core promise | full groove, impact + crash, the bass enters |
| Verse | information-dense scenes | thinner: fewer layers, lower hats, so text reads |
| Break | before the payoff | pad + motif, no kick; a tape stop or stutter into it for a jolt |
| Drop 2 | the payoff (proof, offer) | the fullest section — add a layer the first drop didn't have |
| Outro | the lockup / CTA | the sonic logo, a last hit, then a tail ≥ 1.5 s (reverb, last chord); nothing new after it |

Keep something changing every 2–4 bars (a layer in or out, a fill, a new bass rhythm, a filter move) — a one-bar
loop repeated for 8 bars sounds like a template. Start the drums on the first reveal, not before.

## 6. The hook and the sonic logo

- A motif of 2–4 notes in the key, one bar or shorter, rhythmically simple — hummable.
- It plays on the logo reveal, every time the brand appears, and once earlier as a hint (first product shot).
- Its timbre fits the brand: bells / glass (clean tech), brass (bold), vox (human, warm), harp / pluck (organic,
  flowers, kids), cowbell (phonk), chip (games), piano (premium, emotional).
- Tune UI pops, dings and blips to the scale (`scale('F', 'minor').deg(i, 5)`), so sound effects sound like music.

## 7. Brand-world sounds

One to four sounds that only this brand's video would have — the ingredient that stops every promo sounding alike.
Build them from `noiseHit` (shaped noise), `toneSweep` (glides, motors), `bell` (metal, glass), `tick`, or a new voice
(synth-api.md, "Writing a new voice"). Drive them from the same schedule as the picture (an rpm curve that moves the
needle AND the engine; a typing schedule that prints letters AND clicks keys).

| World | Sound ideas |
|---|---|
| Auto parts, cars | engine (saw `toneSweep` + noise following an rpm curve), starter, turbo blow-off (noise sweep down), grinder sparks, tyre screech, gear shift clunk |
| Coffee, cafés | burr grinder (band-passed noise with random amplitude), steam wand (high-passed noise, slow attack), cup clink (bell ratio 2.76, short), pour (low-passed noise sweeping) |
| Bakery, food | crunchy crust (dense ticks), oven ding, dough thud, sizzle (high-passed noise crackle) |
| Flowers, gifts | paper wrap (`paper`), stem snip (bright tick + short noise), airy chimes, a bloom swell |
| Delivery, logistics | scooter (square `toneSweep` + LFO), door knock (`thud` ×2), box landing, notification `ding` |
| Fintech, shops | `coin`, card tap (`click` + `blip`), `success` arpeggio, till drawer (noise burst + bell) |
| AI, bots, SaaS | data blips in the scale, `glitch`, `key` typing, message `pop`, generated-content whoosh |
| Fitness, health | `heartbeat`, breath (shaped noise), barbell clank (bell ratio 1.41 + `thud`) |
| Real estate | door, keys jingle (dense high bells), footsteps (soft thuds), city air (low-passed pink noise) |
| Kids, games | `boing`, `goo`, `pop`, whistle (sine `toneSweep`), xylophone runs, `blip` confirmations |
| Beauty, fashion | spray (high-passed noise, 50 ms attack), cap click, `sparkle`, silk swish (soft `whoosh`) |

## 8. The SFX map

List every visible event of the storyboard and decide its sound (or a deliberate silence):

| On screen | Sound | Timing |
|---|---|---|
| Text / logo slam | `impact` (sub in the key), `crash` for the big ones | exactly on the landing frame |
| Whip pan, fast move | `whoosh` — dur = the move, pan follows its direction; 'in' when it lands on something | starts with the move |
| Items appearing (cards, icons, pills) | `pop` tuned to the scale, one per item, pan by screen x | on each appearance |
| Number rolling | `tick`s at the times the digits change (same easing as the picture), pitch rising | computed from the easing |
| Typing | `key` per character, from the same schedule as the text | per character |
| Tap, click, toggle | `click`, `blip`; success → `success` / `ding`; error → `errorBuzz` | on the press |
| Glitch, decode | `glitch` or rapid ticks | over the effect |
| Shine, sweep of light | `swish` high or `sparkle` | with the sweep |
| Big reveal | `riser` before + `reverseCymbal` ending on it + `gap` + `impact` + `boom` + `crash` | the reveal frame |
| Camera shake | short `boom` / soft kick | on the shake |
| Paper, photos, cards flying | `paper` | per item, thinned out |
| Split-flap, counters of many digits | one `tick` per flap, capped to one per 10 ms bucket | per flap |
| End card | final hit + ring-out ≥ 1.5 s, nothing new after | the last hit |

SFX live 3–6 dB under the music except the hero hits. Never two whooshes on the same moment; the smaller the UI
element, the quieter and shorter its sound.

## 9. Mixing

- **Bus gains (dB) to start from**: drums -2, bass -4…-6, music -5…-8, lead -6…-8, fx -4…-6. Adjust with the report.
- **Sidechain** (`duck` on a bus, keyed by kicks): bass 0.5–0.6, music 0.35–0.45, lead 0.2; EDM / future bass pump
  0.6–0.75; lo-fi and ambient 0.15–0.3 or none. Add a second key for hero hits: `trigger('hit', t)` +
  `duck: [{ from: 'kick', depth: 0.5 }, { from: 'hit', depth: 0.4, release: 0.3 }]`.
- **Low end has one owner at a time**: a kick and an 808 note on the same hit fight — let the 808 carry it, or duck the
  bass under the kick. `render({ monoBass: 120 })` keeps everything under 120 Hz mono.
- **Mud**: pads and keys high-passed at 150–250 Hz (`supersaw` does 180 by default); thin chords to 3–4 notes.
- **Space**: reverb 'plate' (pop, EDM), 'hall' (cinematic), 'room' (lo-fi, funk), 'dark' (moody), 'huge' (ambient);
  delay 0.75 beat (dotted eighth) on leads and plucks; reverb lives on the sends, not on the kick or the bass.
- **Colour**: `drive` on drums / bass for grit (phonk, trap, rock); `crush` for lo-fi and chip; `chorus` on keys and
  pads for width; `eq` bands on a bus to carve (e.g. music `eq: [{ f: 300, g: -3 }]` when the kick is boomy).

## 10. Loudness

`render(file, { lufs, truePeak })` normalises to the target (ITU BS.1770) with a true-peak-safe limiter.
- -14 LUFS: default (YouTube, Instagram, TikTok normalise around there).
- -12 … -11 LUFS: club genres (phonk, trap, EDM) posted where nothing normalises (Telegram, VK, X).
- -16 … -15 LUFS: ambient, luxury, lo-fi — let them breathe.
- True peak ≤ -1 dBTP always (AAC adds a little). If the render says the limiter pulls more than 6 dB, a bus is too
  peaky (usually fx hits or drums) — lower it rather than squashing the mix.

## 11. Checking

1. `node audio/score.mjs --report` — per-bus RMS for every scene window. In drops the drums bus is the loudest; music
   sits 4–10 dB under; the intro is quieter than the drop (by 3+ LU in the master column).
2. `node tools/audio-check.mjs` — must show no FAIL. Read the band balance: typical for bass-driven genres sub -8…-4,
   bass -7…-3, low-mid -16…-10, mid -20…-14, presence -26…-18, air -30…-18 dB; ambient and lo-fi sit lower in sub
   and air. It warns about mud, dullness, harshness, a flat energy arc, an abrupt ending.
3. Open `out/qa/music-audio.png`. Cyan lines = scene starts, yellow = cues, faint white = bars. Check:
   - every hit's bright vertical stripe sits ON its yellow line (not before, not after);
   - drops are denser and brighter than intros; the hole before the logo is a dark column;
   - risers are rising diagonals that end on the cue; the tail fades to black before the end;
   - no constant bright band in the low-mids (mud) or across the top (hiss).
4. Zoom into a transition: `node tools/audio-check.mjs --zoom 7-9`.
Fix, re-render the score (seconds), re-check. Only then render the video.

## 12. Never the same twice

The trap: one synth, one habit, and every video ends up house at 120–128 BPM with the same kick on every beat, the
same off-beat hats and the same pads. Its author hears "about the same everywhere", even with new chords each time.
What a listener recognises first is the **groove** (where kick, snare and hats fall) and the **timbre** (the kit and
the instruments); then tempo and key; the chords last.

`node tools/audio-check.mjs` measures it: the `unique` line and the "nearest scores" list compare this track's
fingerprint (`tools/sound-print.mjs`: tempo, key, a 16-step kick/snare/hat pattern, a 24-band spectrum, the chroma)
with the template demo, with every promo project in the same parent folder (their `out/qa/*-print.json` or
`out/music*.wav`) and with anything you pass: `--against ../old-promo other.wav`. 1.00 is the same track; ≥ 0.75
too close (WARN); the demo itself FAILs at ≥ 0.85. The list says what matches ("same tempo 128≈128, groove r 0.93,
timbre Δ 1.8 dB"). Change what it names — not the seed, not the chords alone:

| It says | Change |
|---|---|
| groove | another genre card: half-time trap, broken beat, DnB, 6/8, amapiano log drums, lo-fi swing, no kick at all |
| timbre | other voices: a different kick type, `ks` / harp / marimba instead of pads, brass or vox lead, a band (keys + bass + kit) instead of synths |
| tempo | 20 % or more away (a 120 → 96 or 150), or half-time over the same BPM |
| key / chord colours | another root and mode (Dorian, Lydian, pentatonic), a different progression shape |

The score is groove 35 %, timbre 35 %, tempo 30 % — the per-trait numbers after each match show which one to move.
A new lead or hook voice, new chords or a new key hardly move it, on purpose: over the same kit, groove and tempo
they are the same track to a listener. Nudging a pattern until the number slips just under 0.75 is not the goal
either — a different brief should land well below 0.65.

Also compare by the brief: same genre? same kick type? same lead voice? same hook shape? If three or more match an
earlier video, it is not new yet. Every score needs at least one brand-world sound (section 7) — the part no other
brand's video can have. A series for one brand may keep its sonic logo on purpose; everything around it still moves.
