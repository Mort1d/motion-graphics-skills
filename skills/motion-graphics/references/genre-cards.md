# Genre cards

Recipes to start a score from — tempo, drum grid, bass, harmony, signature voices, effects, mix — written in the
synth's own terms (synth-api.md). A card is a starting point: change the kit characters, the progression and the hook
so the result belongs to the brand (sound-design.md §7, §12).

Grid notation: 16 steps per bar (sixteenth notes). `X` accent, `x` hit, `o` ghost, `.` rest — feed straight to
`steps(pattern, { from, to })`. Progressions in roman numerals for `prog()`, or chord symbols for `harmony()`.

## Contents
1. Drift phonk · 2. Trap · 3. House / tech house · 4. Deep house · 5. Nu-disco · funk / boogie · 6. Future bass / pop EDM ·
7. Synthwave · 8. Lo-fi hip-hop · 9. Afro house / amapiano · 10. Latin / dembow · 11. Drum & bass · 12. UK garage ·
13. Cinematic hybrid · 14. Corporate / minimal pulse · 15. Kids / playful pop · 16. Chiptune · 17. Luxury ambient ·
18. Rock-ish hybrid · 19. Breakbeat / big beat · 20. Jersey club · 21. Baile funk · 22. Hyperpop / glitch-pop

Groove families (sound-design.md §3): four on the floor 3, 4, 5 (nu-disco), 9, 14 (4/4); backbeat 5 (funk / boogie),
7, 8, 15, 18; half-time 1, 2, 6, 13, 22; broken 11, 12, 19, 20, 21; no kick 17, 14 without its kick. Four on the floor
is what every generated promo reaches for — take it only when the brand lives in clubs or the user asks for it.

## 1. Drift phonk
- **Tempo / key**: 125–145 BPM (128–135 sweet spot); minor, phrygian or harmonic minor. -12 LUFS.
- **Drums**: kick '808' or 'hard' `X.....x...x.....`; clap on 2 & 4 `....X.......X...`; hats 8ths `x.x.x.x.x.x.x.x.` with a
  32nd-note `roll` into every second bar; open hat on the last off-beat of odd bars.
- **Bass**: `bass808` drive 2.5–3.5, a note on every kick, gliding (`from`) into the next root; octave jumps on
  syncopations.
- **Harmony**: i–i–VI–VII or i–VI–iv–V (harmonic minor); dark pad under the breakdowns only.
- **Signature**: `cowbell` riff — a one-bar syncopated motif (steps 0, 3, 6, 8, 11, 13) doubled an octave up in drop 2;
  the lead bus loud (phonk puts the cowbell up front).
- **FX**: reverse cymbals into drops, tape stop into breaks, impacts with an 808 under the slams, car / street foley.
- **Mix**: bass duck 0.55, plate reverb short, bass and drums driven.
- **Fits**: cars, gyms, streetwear, gaming, anything with attitude.

## 2. Trap
- **Tempo / key**: 130–150 BPM with a half-time feel; minor. -12 LUFS.
- **Drums**: kick 'punch' sparse `X.........X.....`; snare 'trap' on beat 3 `........X.......`; hats 8ths with rolls
  (`roll(t0, t1, fn, { from: 1/8, to: 1/32 })`) and triplet bursts; open hat once per 2 bars.
- **Bass**: `bassLine` with slides (`slide: true`), long 808 notes; drive 2–3.
- **Harmony**: i–VI or i–iv minor loops; sparse.
- **Signature**: dark `bell` (ratio 3.5) or `pluck` 'fm' melody, a `vox` or `chop` for the hook.
- **FX**: risers + `gap` before drops, `stutter` on the last beat of a phrase.
- **Mix**: bass duck 0.4 (the 808 is the low end), drums hot, reverb 'dark'.
- **Fits**: fashion, sneakers, sport, nightlife, bold launches.

## 3. House / tech house
- **Tempo / key**: 120–126 BPM; minor or dorian. -13 LUFS.
- **Drums**: kick 'punch' `X...X...X...X...`; clap `....X.......X...`; open hat off-beats `..X...X...X...X.`
  (decay 0.08–0.12); closed 16ths with ghosts `x.o.x.o.x.o.x.oo` (swing 0.06–0.1); `shaker` 16ths.
- **Bass**: `houseBass` off-beat `..x...x...x...x.` or rolling `..x.x.x...x.x.xX` (octave on X); `acid` for tech house.
- **Harmony**: i–VI–VII–i, or dorian vamps (i7–IV7); m7 / m9 chords.
- **Signature**: off-beat `stab` (supersaw) or `keys` 'organ' stabs, a filtered `pluck` arp in drop 2.
- **FX**: `automate(bus, 'lp', …)` filter opening over the build, reverse cymbal, crash on drops.
- **Mix**: bass duck 0.55, music 0.4; plate reverb; delay 0.75 beat on plucks.
- **Fits**: apps, e-commerce, lifestyle, fashion, bars, "modern and busy".

## 4. Deep house
- **Tempo / key**: 118–122 BPM; minor 7th / 9th colours. -14 LUFS.
- **Drums**: kick 'deep' four-on-the-floor; `rim` or `snap` on 2 & 4; `shaker` 16ths; soft open hats.
- **Bass**: `sub` + a soft `houseBass` (bright 0.4), long notes.
- **Harmony**: i9–iv9 or ii9–V9–i; `keys` 'ep' or 'organ' chords with long releases.
- **Signature**: `chop` vocal hooks (vowel 'a' → 'o'), `pad` 'air'.
- **FX**: sparse; long reverb swells, gentle risers.
- **Mix**: reverb 'hall', duck 0.4, wide pads.
- **Fits**: beauty, fashion, hotels, premium lifestyle.

## 5. Nu-disco (4/4) · funk / boogie (backbeat)
- **Tempo / key**: nu-disco 110–122 BPM; funk / boogie 95–112 BPM; major or dorian. -13 LUFS.
- **Drums, nu-disco**: kick 'punch' 4/4; `snare` 'tight' or `clap` on 2 & 4; open hats on off-beats; `conga`
  `..x..x.x..x..x..`. Four on the floor: only for a club-minded brand (sound-design.md §3).
- **Drums, funk / boogie**: kick 'soft' `X.....x...X..x..`; `snare` 'tight' with ghosts `....X..o.o..X.o.`; 16th hats,
  swing 0.08; a `tom` fill at phrase ends. The kick never lands on every beat — that is the whole difference.
- **Bass**: nu-disco: octave `houseBass` 8ths `x.x.x.x.x.x.x.x.`; funk: a syncopated `bassLine` with slides and short
  notes `X..x.x..X.x..x.x` (root, octave, fifth), never a note on every 8th.
- **Harmony**: IV–V–iii–vi or I7–IV7 vamps; 7th and 9th chords.
- **Signature**: `keys` 'clav' riffs, `brass` stabs, `pad` 'strings' swells.
- **FX**: filter sweeps, `crash`es, `sparkle`s on reveals.
- **Mix**: room reverb, moderate duck 0.35 (funk: 0.2 — a live band does not pump).
- **Fits**: food, restaurants, events, playful retail — funk for the warm ones, nu-disco for the club-minded.

## 6. Future bass / pop EDM
- **Tempo / key**: 140–160 BPM, half-time feel; major (IV–V–vi–I or I–V–vi–IV). -11…-12 LUFS.
- **Drums**: kick `X.......X.x.....`; snare 'trap' on beat 3; hats with rolls; a snare `roll` + `gap` into every drop.
- **Bass**: `fmBass` with `wobble` 2–4 Hz, or `supersaw` chords doubled an octave down.
- **Harmony**: big `supersaw` chords, 7 voices, detune 0.2–0.3, heavy pump (music duck 0.7).
- **Signature**: `chop` vocal hooks pitched to the melody; `bell` sparkles.
- **FX**: long risers, `boom` + `impact` on drops, reverse cymbals.
- **Mix**: pump everything except drums; plate reverb; loud.
- **Fits**: youth apps, events, tech launches, gaming.

## 7. Synthwave / retrowave
- **Tempo / key**: 90–118 BPM; minor (i–VI–III–VII). -13 LUFS.
- **Drums**: kick 'punch' 4/4 or 1 & 3; `snare` 'gated' on 2 & 4 (big reverb); hats 8ths.
- **Bass**: 8th-note octave pulse — `lead` wave 'saw', cut 700, or `bassLine` straight 8ths.
- **Harmony**: `pad` 'warm' + 'strings'; long chords.
- **Signature**: `lead` saw with `vib` 0.25 and delay, a 16th `arp` of `pluck` 'synth'.
- **FX**: slow sweeps, reverse cymbals, `zap`s.
- **Mix**: hall reverb, chorus on the music bus, duck 0.35.
- **Fits**: gaming, neon nightlife, retro cars, tech with nostalgia.

## 8. Lo-fi hip-hop / chillhop
- **Tempo / key**: 70–90 BPM, swing 0.12–0.2; maj7 / m9, ii–V–I. -15 LUFS.
- **Drums**: kick 'soft' `X......x..X.....`; `snare` 'lofi' on 2 & 4 with ghosts; hats `metal: 0` swung 8ths;
  `humanize: 0.008` everywhere.
- **Bass**: `sub` or a soft `houseBass` (bright 0.3), laid back.
- **Harmony**: `keys` 'ep' jazzy voicings (maj7, m9, 6/9), `voiceLead` them.
- **Signature**: vinyl crackle bed (`noiseHit` pink, hp 900, long, quiet + random pops), tape wobble (music bus
  `chorus: { rate: 0.4, depth: 0.003, mix: 0.3 }`), `crush: { bits: 10, rate: 2 }` on drums.
- **FX**: few: page flips, cup clinks, room tone.
- **Mix**: room reverb, bus `lp` 9000 on music, duck 0.2.
- **Fits**: cafés, bakeries, books, study apps, cozy brands.

## 9. Afro house / amapiano
- **Tempo / key**: 112–118 BPM; minor or major gospel colours (I–vi–ii–V). -13 LUFS.
- **Drums**: kick 'deep' 4/4 (drop some beats); `shaker` 16ths; `conga` / `tom` pattern `..x..x.x..x.x...`;
  `clave` 3-2 son clave `x..x..x...x.x...`.
- **Bass (amapiano log drum)**: `tom` with long decay, or `toneSweep` sine from note + 5 semitones down to the note
  (0.3 s, 'decay' envelope), syncopated.
- **Harmony**: `keys` 'piano' chords, `pad` 'air'.
- **Signature**: `chop` vocals, log-drum bass, shakers.
- **Mix**: room / plate reverb, duck 0.35.
- **Fits**: fashion, beauty, lifestyle, festivals, youth.

## 10. Latin / dembow
- **Tempo / key**: 90–100 BPM; minor (i–VI–III–VII). -12 LUFS.
- **Drums**: kick on every beat `X...X...X...X...`; `snare` 'tight' / `rim` on the dembow `...x..x....x..x.`; hats 8ths.
- **Bass**: `bass808` or `sub` on the kicks, short.
- **Harmony**: `pluck` 'ks' (guitar-like) arpeggios, `brass` hits.
- **Signature**: plucked riffs, brass stabs, `conga`s.
- **Mix**: plate reverb, duck 0.4.
- **Fits**: food, beach, fitness, parties, latin audiences.

## 11. Drum & bass
- **Tempo / key**: 170–176 BPM; minor. -12 LUFS.
- **Drums**: kick `X.........X.....`; snare 'tight' on 2 & 4 (steps 4, 12); hats 16ths / `ride`; fills with `roll`.
- **Bass**: `reese` (dark, neuro-lite) or `sub` + a pad (liquid).
- **Harmony**: liquid: `pad` 'air' + `pluck` 'fm'; neuro: minimal, bass-led.
- **FX**: `riser`, `downlifter`, `zap`, `glitch`.
- **Mix**: drums very present, bass duck 0.5, plate reverb.
- **Fits**: sport, extreme, energy drinks, "fast delivery", speed claims.

## 12. UK garage / 2-step
- **Tempo / key**: 130–134 BPM; minor 7 / 9. -13 LUFS.
- **Drums**: 2-step kick `X.........X...x.`; `clap` on 2 & 4; shuffled hats (swing 0.18) with 'o' ghosts;
  `shaker`.
- **Bass**: `keys` 'organ' low or `houseBass`, bouncy.
- **Harmony**: m7 / m9 `stab`s.
- **Signature**: pitched `chop` vocals, organ bass.
- **Mix**: room reverb, duck 0.45.
- **Fits**: urban fashion, nightlife, music apps.

## 13. Cinematic hybrid (trailer)
- **Tempo / key**: 60–100 BPM, or 120 with half-time hits; minor / phrygian. -14 LUFS, wide dynamics (LRA 6–10).
- **Drums**: taiko-like `tom` (low notes) + kick 'boom' patterns; ticking pulse (bright `tick` 8ths + `sub` pulse).
- **Bass**: `sub` drones, `boom` drops on hits.
- **Harmony**: `pad` 'strings' ostinato (16th `pluck` 'ks' or short `lead` saw), `pad` 'dark'.
- **Signature**: `braam` on reveals, `riser` type 'shepard' for tension, silence (`gap`) before every big hit.
- **FX**: `impact` + `boom` + `crash` stacks, `downlifter`s after hits.
- **Mix**: huge / hall reverb, little duck.
- **Fits**: launches, B2B, real estate, finance, "serious" announcements.

## 14. Corporate / minimal pulse
- **Tempo / key**: 100–120 BPM; major / lydian (bright) or minor (serious). -14 LUFS.
- **Drums**: half-time — kick 'tight' on 1 `X.........x.....`, `snap` / `clap` on 3, sparse hats; or no kick at all: a
  bright `tick` pulse in 8ths over a `sub` on the roots. 4/4 only for an upbeat consumer brand.
- **Bass**: `sub` on the roots, some `houseBass` bright 0.5.
- **Harmony**: `pad` 'glass', `pluck` 'fm' 16th arps.
- **Signature**: a clean `bell` motif (ratio 2.01), subtle `glitch` and data `blip`s in the scale.
- **Mix**: plate reverb, delay on plucks, duck 0.3.
- **Fits**: SaaS, fintech, AI, B2B, consulting.

## 15. Kids / playful pop
- **Tempo / key**: 100–125 BPM; major pentatonic. -14 LUFS.
- **Drums**: a backbeat — kick 'soft' `X.......X.x.....`, `clap` on 2 & 4, `shaker`, handclap fills.
- **Bass**: `chipBass`, or a bouncy `bassLine` jumping octaves on the off-beats — not a note on every 8th.
- **Harmony**: I–V–vi–IV, `pad` 'glass' bright.
- **Signature**: `pluck` 'marimba' / 'kalimba' melodies, whistle (`toneSweep` sine glides), `boing`, `pop`, `goo`.
- **Mix**: room reverb, duck 0.3.
- **Fits**: kids' EdTech, toys, family, pets.

## 16. Chiptune
- **Tempo / key**: 120–160 BPM; major or minor. -13 LUFS.
- **Drums**: `hat` metal 0 short (noise channel), kick 'punch' short, `snare` 'tight'; music bus `crush: { bits: 6, rate: 3 }`.
- **Bass**: `chipBass` (triangle).
- **Harmony**: `chip` with `arp: [0, 4, 7]` at rate 1/8 beat (the chip chord).
- **Signature**: `chip` lead duty 0.25 / 0.125 with `echo`, `blip`s, pixel sweeps (fast `chip` runs).
- **Mix**: little reverb, no sidechain or a light one.
- **Fits**: games, pixel brands, retro tech, kids' tech.

## 17. Luxury ambient
- **Tempo / key**: 60–95 BPM, sparse or no drums; lydian, maj7 / add9. -16…-15 LUFS.
- **Drums**: a `heartbeat` or kick 'deep' every bar at most; `shaker` very soft.
- **Bass**: `sub` long notes.
- **Harmony**: `keys` 'piano' + `pad` 'glass' / 'air', `voiceLead`.
- **Signature**: `pluck` 'harp' glissandi, `sparkle`s, long `bell` tails.
- **FX**: slow swells, reverse reverbs (a `riser` type 'tone', soft).
- **Mix**: huge reverb, delay 0.75 beat, no duck.
- **Fits**: jewellery, perfume, spa, premium real estate, flowers.

## 18. Rock-ish hybrid
- **Tempo / key**: 120–150 BPM; minor / mixolydian. -12 LUFS.
- **Drums**: kick 'hard' + `snare` 'fat', crashes on phrase starts, `tom` fills.
- **Bass**: `reese` or `bassLine` driven hard.
- **Harmony**: power chords (root + fifth) as `brass` / `supersaw` with bus `drive: 3` and `lp` 3500 — a synth take on
  guitars (lean into it; don't fake a real guitar).
- **FX**: impacts, `riser`s, `stutter`s.
- **Mix**: room reverb, duck 0.3, drums loud.
- **Fits**: sport, gyms, auto, extreme.

## 19. Breakbeat / big beat
- **Tempo / key**: 125–140 BPM; minor or mixolydian. -12 LUFS.
- **Drums**: a broken beat, never 4/4 — kick 'punch' `X.........X.x...`, `snare` 'fat' `....X..o.o..X..o`, hats
  `x.x.x.x.x.x.x.xX` with an open hat on the last step of odd bars; drums bus `drive: 3` and
  `crush: { bits: 12, rate: 2 }` for the sampled-break grit; vary the second bar (a kick moved, a snare flam).
- **Bass**: `acid` riff with `automate(bus, 'lp', …)` opening over 8 bars, or a driven `reese`.
- **Harmony**: riff-based, one or two chords (i–VII); `brass` or `stab` hits on the accents.
- **Signature**: the acid squelch, a shouted `chop` hook, `zap`s; a `tapeStop` into the break.
- **FX**: `stutter` on phrase ends, `riser` + `crash` into drops, `impact` on slams.
- **Mix**: room reverb, duck 0.3, drums up front.
- **Fits**: energy drinks, sport, gaming, streetwear, bold and loud launches.

## 20. Jersey club
- **Tempo / key**: 135–145 BPM (140); minor. -11…-12 LUFS.
- **Drums**: the five-kick bounce `X..X..X...X.X.X.` (kick '808' short, `len` 0.25); `clap` `....X.......X...` plus a
  16th flam before beat 4 in every second bar; sparse hats.
- **Bass**: short `bass808` notes on selected kicks.
- **Harmony**: a minor two-chord loop, thin (`pad` 'dark' or none).
- **Signature**: a pitched `chop` stuttering in 16ths, a squeak (`goo` or a short `boing`) on the off-beats — the
  genre's calling card.
- **FX**: `stutter`, `gap`s before every drop, siren sweeps (`toneSweep` sine).
- **Mix**: plate, duck 0.4, loud and dry drums.
- **Fits**: sneakers, youth and dance apps, TikTok-first brands, parties.

## 21. Baile funk
- **Tempo / key**: 125–135 BPM (130); minor or phrygian. -11…-12 LUFS.
- **Drums**: the tamborzão — kick '808' + low `tom` on `X..x..x...x..x..`, `clap` or `snap` `....x.......x...`,
  `shaker` 16ths; `humanize: 0.006`.
- **Bass**: distorted short `bass808` following the tamborzão.
- **Harmony**: minimal: a two-note `lead` 'square' riff or `brass` stabs, phrygian colour.
- **Signature**: a `vox` / `chop` call-and-response shout, whistle glides (`toneSweep` sine), `cowbell` accents
  (with a `cowbell` riff on top it becomes Brazilian phonk).
- **FX**: `glitch`, `stutter`, sirens.
- **Mix**: drums and bass `drive: 2.5`, duck 0.35, short plate.
- **Fits**: fashion, streetwear, beachwear, fitness, parties, anything hot and bold.

## 22. Hyperpop / glitch-pop
- **Tempo / key**: 140–170 BPM; major with sugary colours (I–V–vi–IV) or minor. -10…-11 LUFS (loud on purpose).
- **Drums**: kick 'punch' with `drive: 4` (clipped on purpose), `snare` 'trap' on beat 3 (half-time) or on 2 & 4, 16th
  hats with `roll`s; a `stutter` every 2 bars.
- **Bass**: `fmBass` or `bass808`, heavily driven.
- **Harmony**: `supersaw` chords high (oct 5), `chip` arps, `pad` 'glass'.
- **Signature**: pitched `chop` vocals, a `chip` lead on a crushed lead bus (`crush: { bits: 8, rate: 2 }`), `glitch`
  bursts, a `stutter` with `slice: 1/16` into every drop.
- **FX**: `glitch`, `zap`, `tapeStop`, `sparkle`s, sudden `gap`s.
- **Mix**: bright, plate reverb, duck 0.5.
- **Fits**: youth apps, gaming, creators, AI toys, internet-native brands.
