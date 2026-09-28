# Synth API

`audio/synth/` in every project — zero dependencies, deterministic (seeded), 48 kHz stereo, offline. Import all of it:
`import * as A from './synth/index.mjs'`. Times are seconds (use `b(n)` from `js/timeline.mjs` for beats); notes are
MIDI numbers or names ('C3', 'F#4', 'Bb2'); chords are arrays of notes. `node audio/synth/selftest.mjs` renders every
voice and checks it; `--wav out/tour.wav` writes all of them one after another.

## Contents
1. Song, buses, time
2. Theory and sequencing
3. Drums
4. Bass
5. Pads, stabs, keys, plucks, bells
6. Leads, chip, brass, voices, arps
7. Sound effects and builders
8. Arrangement moves and automation
9. Render (mix and master)
10. Writing a new voice

Common options on every voice, including rows below that list none: `vel` (loudness, 1 = calibrated default), `pan`
(-1 … 1), `bus` (target bus name), `verb` / `delay` (per-hit sends, 0 … 1). Times are seconds, frequencies Hz (notes as
'C4' where a row says so); a wrong type makes NaN, and `render()` then stops with the bus and the time it appeared.

## 1. Song, buses, time

| Call | What |
|---|---|
| `init({ duration, bpm, seed })` | start a song; duration = the video length (seconds) |
| `bus(name, opts)` | configure a bus: `gain` (dB), `pan`, `width` (0 mono … 2), `hp` / `lp` (Hz), `lpq`, `eq: [{ f, g, q, type: 'peak'|'low'|'high' }]`, `drive` (1 … 6), `crush: { bits, rate }`, `chorus: { rate, depth, mix }`, `comp: { threshold, ratio, attack, release, makeup }`, `duck` (0 … 1 against kicks, or `[{ from, depth, attack, release }]`), `verb`, `delay` (send levels), `mute` |
| default buses | `drums` -2 dB · `bass` -4 dB duck 0.5 · `music` -4 dB duck 0.35 · `lead` -5 dB duck 0.25 · `fx` -4 dB · `verb`, `delay` = the returns' gain |
| `beats(n)`, `bars(n)` | durations in seconds at the song's bpm |
| `note('C#3')`, `hz(n)`, `mtof(m)` | note name → MIDI → Hz |
| `rand()`, `between(a, b)` | seeded randomness (never Math.random) |
| `trigger(key, t, amount)` | a sidechain trigger (kicks register `'kick'` themselves) |

## 2. Theory and sequencing

| Call | What |
|---|---|
| `scale(root, mode)` → `{ deg(i, oct), notes(oct) }` | modes: major, minor, dorian, phrygian, lydian, mixolydian, harmonicMinor, melodicMinor, phrygianDominant, pentatonic, minorPentatonic, blues, wholeTone, hirajoshi, inSen |
| `chord('Am7', oct)` | chord symbol → notes (`.root` = bass note an octave below). Qualities: '' m dim aug 5 sus2 sus4 6 m6 7 maj7 m7 mM7 dim7 m7b5 7sus4 add9 madd9 9 maj9 m9 11 m11 13 6/9, slash chords 'C/E' |
| `prog('i VI III VII', 'A', 'minor', { oct, sevenths })` | roman numerals → chords (upper case major, lower minor, ° diminished, trailing 7) |
| `voiceLead([chord, chord, …], center)` → the list re-voiced | move chord notes by octaves for smooth pads and keys; one chord: `voiceLead([c])[0]` |
| `harmony([[beat, 'Fm9'], [beat, 'Dbmaj7'], …], { oct })` → `{ at(beat), spans(b0, b1) }` | ONE progression table that bass, stabs, pads and arps all read |
| `steps('X...x...', { from, to, step, swing, humanize })` → `[{ t, vel, i, bar }]` | drum-grid pattern, loops from `from` to `to`; X 1.0, x 0.8, o 0.45 |
| `seq('C4 . Eb4 _ G4~ Bb4!', { from, step, loops })` → `[{ t, dur, note, vel, slide, accent }]` | note string: '.' rest, '_' hold, '~' slide into, '!' accent |

## 3. Drums (bus 'drums')

| Voice | Character options |
|---|---|
| `kick(t, { type, tune, sweep, decay, click, drive, len, duck })` | type 'punch' · 'deep' · 'hard' · '808' · 'soft' · 'boom' · 'tight'; `tune` in Hz or a note ('A1'); registers a 'kick' trigger unless `duck: false` |
| `snare(t, { type, tone, snap, decay, bright })` | 'tight' · 'fat' · 'trap' · 'lofi' · 'gated'; `tone` in Hz or a note |
| `clap(t, { spread, decay, tone })` | four bursts + tail |
| `rim(t, { tune })`, `snap(t)` | side-stick, finger snap |
| `hat(t, { open, decay, tone, metal })` | metal 0.8 = TR-808 six-oscillator metal, 0 = soft noise (lo-fi, chip); tone is a multiplier, 0.8 dark … 1.3 bright (not Hz) |
| `ride(t)`, `crash(t, { dur })`, `shaker(t, { tone })` | |
| `tom(t, note, { decay, slap })`, `conga(t, note)`, `clave(t, note, { decay })` | pitched percussion |
| `cowbell(t, note, { dur, cut, duty })` | TR-808 cowbell, pitched — the phonk riff voice (bus 'lead') |
| `roll(t0, t1, (t, vel, i) => …, { from, to, vel0, vel1, curve })` | accelerating fills: step from `from` to `to` beats |

## 4. Bass (bus 'bass')

| Voice | Use |
|---|---|
| `bass808(t, dur, note, { from, glide, drive, decay, punch, cut })` | trap / phonk 808, glide from `from` |
| `bassLine([{ t, dur, note, slide, vel, decay }], { drive, cut, glide })` | a whole line as one voice, in ONE call: build the list, then call `bassLine(list)` once — building it plays nothing; slides glide from the pitch actually sounding |
| `sub(t, dur, note, { attack, release, drive })` | clean sub |
| `reese(t, dur, note, { detune, cut, env, move, wobble, subLevel, drive })` | dnb, dark techy |
| `acid(t, dur, note, { from, cut, env, reso, decay, accent, wave, drive })` | 303-style, tech house |
| `houseBass(t, dur, note, { bright, decay })` | plucky house / disco bass with a sub |
| `fmBass(t, dur, note, { ratio, index, sustain, wobble, drive, cut })` | growl, future bass |
| `chipBass(t, dur, note)` | NES triangle |

## 5. Pads, stabs, keys, plucks, bells (bus 'music')

| Voice | Use |
|---|---|
| `supersaw(t, dur, notes, { voices, detune, width, cut | cutFn(tAbs) | cutHi+cutLo+fdec, hp, attack, release, q })` | EDM chords, pads |
| `stab(t, notes, { dur, … })` | short chord hit |
| `pad(t, dur, notes, { type, attack, release, cut, move })` | 'warm' · 'dark' · 'air' · 'strings' · 'glass' |
| `keys(t, dur, notes, { type, bright, release })` | 'ep' (Rhodes-like) · 'organ' · 'piano' · 'clav' (short and plucky: a long `dur` does not sustain it — for held chords use 'ep' or 'organ') |
| `pluck(t, note, { type, dur, bright, cutHi, cutLo, fdec, ratio })` | 'synth' · 'harp' · 'ks' (string) · 'marimba' · 'kalimba' · 'fm' |
| `bell(t, note, { ratio, index, idec, dur })` | ratio 3.5 bell · 3.01 glass · 2 chime · 4 wood · 1.41 metal |

## 6. Leads, chip, brass, voices, arps

| Voice | Use |
|---|---|
| `lead(t, dur, note, { wave, pw, unison, detune, cut, env, fdec, reso, vib, vibRate, vibDelay, from, glide, drive, attack, release })` | bus 'lead'; wave 'saw' · 'square' · 'pulse' · 'sine' · 'tri' |
| `chip(t, dur, note, { duty, slide, vib, arp: [0, 4, 7], rate, decay, cut, echo })` | NES-like pulse; `arp` = the chip chord |
| `brass(t, dur, notes, { swell, cut })` | stabs and swells |
| `vox(t, dur, note, { vowel, toVowel, attack, release, vib })` | formant voice: choir pads, 'ooh / aah' |
| `chop(t, note, { dur, vowel })` | vocal chop hook |
| `arp(t0, t1, notes, { rate, pattern, octaves, gate, voice(t, note, dur, vel, i) })` | 'up' · 'down' · 'updown' · 'random' |

## 7. Sound effects and builders (bus 'fx')

| Call | Use |
|---|---|
| `whoosh(t, dur, { f0, f1, q, pan: [from, to], shape })` | shape 'swell' (passes) · 'in' (lands) · 'out' (leaves); the only voices with a moving `pan: [from, to]` are `whoosh` and `swish` — every other voice takes one number |
| `swish(t, { dur, pan })` | short bright move |
| `riser(t0, t1, { type, f0, f1, curve })` | 'both' (noise + tone) · 'noise' · 'tone' · 'shepard' |
| `downlifter(t, dur)`, `reverseCymbal(tEnd, dur)` | reverse cymbal ENDS at tEnd |
| `impact(t, { sub, air, crack, decay })`, `boom(t, { from, to, dur })`, `braam(t, dur, { note })` | hits |
| `tick(t, { bright, dur, q })`, `click(t)`, `key(t)` | UI, counters, typing |
| `pop(t, note)`, `blip(t, note, { dur, duty })`, `ding(t, note, { n2 })` (n2: the second note, default a fifth up), `success(t, root)`, `sparkle(t, { count, spacing })` | tuned UI |
| `coin(t)`, `shutter(t)`, `buzz(t, { dur })`, `paper(t, { dur })`, `thud(t, { f0 })` | foley |
| `glitch(t, dur)`, `zap(t)`, `boing(t, { f })`, `goo(t, dur, { f0, f1 })`, `heartbeat(t)`, `errorBuzz(t)` | character |
| `noiseHit(t, dur, { bp | lp | hp, q, attack, decay, sweepTo, pink })` | shaped noise — steam, spray, sizzle, sand, air, crowd |
| `toneSweep(t, dur, { wave, from, to, bend, cut, drive, vibrato, env })` | glides — motors, lasers, sirens, whistles; `from`/`to` notes or `{ hz }` |

## 8. Arrangement moves and automation

| Call | What |
|---|---|
| `gap(t0, t1, { buses, fade })` | silence buses (default drums, bass, music, lead) — the hole before a hit |
| `tapeStop(t, dur, { buses, until })` | real tape stop of what was written, silent until `until` |
| `stutter(t, { reps, slice, buses })` | repeat the first `slice` beats |
| `automate(bus, 'lp' | 'hp' | 'gain', [[t, value], …])` | filter sweeps (Hz, exponential), gain rides (dB) |

Moves apply after all notes are written, whatever order you call them in.

## 9. Render

`render(file, { lufs, truePeak, reverb, delay, eq, glue, monoBass, fadeOut, sections, report })`

- `lufs` -14 default; `truePeak` -1 dBTP ceiling (limiter keeps a 0.2 dB margin).
- `reverb`: 'room' · 'hall' · 'plate' · 'huge' · 'dark' or `{ room, damp, width, predelay }`.
- `delay`: `{ beats: 0.75, feedback: 0.38, lp: 3800 }` (ping-pong on the delay sends).
- `eq`: master bands `[{ f, g, q, type }]`; `glue` 0 … 1 soft saturation (default 0.3); `monoBass` Hz (default 120).
- `sections`: `S` from the timeline → with `report: true` or `--report`, a per-bus level table per scene.
- Prints integrated LUFS, true peak, the limiter's largest gain reduction. Returns `{ I, tp, gr }`.
- `loudness(L, R)` → `{ I, window(t0, t1) }` and `truePeak(L, R)` are exported for your own checks.

## 10. Writing a new voice

Any sound you can describe as oscillators, noise, filters and envelopes is ~15 lines. Pattern:

```js
import { SR, TAU, writer, at, noise, svf, drive, hz } from './synth/index.mjs';

/** Espresso steam: high-passed noise that swells in, with a hissing flutter. */
export function steam(t, dur, o = {}) {
  const w = writer(o.bus || 'fx', { pan: o.pan, verb: o.verb ?? 0.2, gain: o.vel ?? 1 });
  const f = svf();
  const i0 = at(t);
  for (let k = 0; k < dur * SR; k++) {
    const s = k / SR;
    const env = Math.min(1, s / 0.15) * Math.min(1, (dur - s) / 0.1);          // attack, release: no clicks
    const flutter = 0.8 + 0.2 * Math.sin(TAU * 23 * s);
    w(i0 + k, f(noise(), 3500 + 1500 * s / dur, 0.9).hp * env * flutter * 0.5);
  }
}
```

Rules: ramp every start and end (1–5 ms minimum) or it clicks; use `noise()` / `rand()` (seeded), never
`Math.random`; keep `vel: 1` near the other voices' levels (run the selftest's approach: peak ≈ 0 dB for hits); a
stereo voice passes `(i, left, right)` to `w`.
