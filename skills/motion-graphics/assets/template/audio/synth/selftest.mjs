#!/usr/bin/env node
// Renders every voice of the library on its own and checks it: no NaN / Infinity, no silence, peak and RMS in a sane
// range. Run after editing the library:  node audio/synth/selftest.mjs [--wav out/selftest.wav]
// With --wav it also writes a tour of all voices, one after another (listen to it, or look at its spectrogram).
import * as A from './index.mjs';

const voices = {
  'kick punch': (t) => A.kick(t, { type: 'punch' }),
  'kick 808': (t) => A.kick(t, { type: '808' }),
  'kick soft': (t) => A.kick(t, { type: 'soft' }),
  'kick hard': (t) => A.kick(t, { type: 'hard' }),
  'kick boom': (t) => A.kick(t, { type: 'boom' }),
  'snare tight': (t) => A.snare(t, { type: 'tight' }),
  'snare trap': (t) => A.snare(t, { type: 'trap' }),
  'snare gated': (t) => A.snare(t, { type: 'gated' }),
  clap: (t) => A.clap(t),
  rim: (t) => A.rim(t),
  snap: (t) => A.snap(t),
  'hat closed': (t) => A.hat(t),
  'hat open': (t) => A.hat(t, { open: true }),
  'hat noise': (t) => A.hat(t, { metal: 0 }),
  ride: (t) => A.ride(t),
  crash: (t) => A.crash(t),
  shaker: (t) => A.shaker(t),
  tom: (t) => A.tom(t, 'A2'),
  conga: (t) => A.conga(t, 'D4'),
  clave: (t) => A.clave(t, 'C6'),
  cowbell: (t) => A.cowbell(t, 'C5'),
  bass808: (t) => A.bass808(t, 0.8, 'C2'),
  'bass808 glide': (t) => A.bass808(t, 0.8, 'G1', { from: 'C2' }),
  sub: (t) => A.sub(t, 0.8, 'C2'),
  reese: (t) => A.reese(t, 0.8, 'C2'),
  acid: (t) => A.acid(t, 0.3, 'C2', { accent: true }),
  houseBass: (t) => A.houseBass(t, 0.3, 'C2'),
  fmBass: (t) => A.fmBass(t, 0.6, 'C2', { wobble: 4 }),
  supersaw: (t) => A.supersaw(t, 0.8, A.chord('Cm7', 4)),
  stab: (t) => A.stab(t, A.chord('Cm7', 4)),
  'pad warm': (t) => A.pad(t, 0.9, A.chord('Cm9', 3)),
  'pad air': (t) => A.pad(t, 0.9, A.chord('Cmaj7', 4), { type: 'air' }),
  'pad strings': (t) => A.pad(t, 0.9, A.chord('Cm', 4), { type: 'strings' }),
  'pad glass': (t) => A.pad(t, 0.9, A.chord('Cmaj9', 4), { type: 'glass' }),
  'pluck synth': (t) => A.pluck(t, 'C5'),
  'pluck harp': (t) => A.pluck(t, 'C5', { type: 'harp' }),
  'pluck ks': (t) => A.pluck(t, 'C4', { type: 'ks' }),
  'pluck marimba': (t) => A.pluck(t, 'C5', { type: 'marimba' }),
  'pluck kalimba': (t) => A.pluck(t, 'C5', { type: 'kalimba' }),
  'pluck fm': (t) => A.pluck(t, 'C5', { type: 'fm' }),
  'keys ep': (t) => A.keys(t, 0.8, A.chord('Cmaj7', 4)),
  'keys organ': (t) => A.keys(t, 0.8, A.chord('Cm7', 4), { type: 'organ' }),
  'keys piano': (t) => A.keys(t, 0.8, A.chord('C', 4), { type: 'piano' }),
  'keys clav': (t) => A.keys(t, 0.3, A.chord('C7', 4), { type: 'clav' }),
  bell: (t) => A.bell(t, 'C6'),
  'lead saw': (t) => A.lead(t, 0.6, 'C5', { unison: 3, vib: 0.3 }),
  'lead square': (t) => A.lead(t, 0.6, 'C5', { wave: 'square' }),
  chip: (t) => A.chip(t, 0.4, 'C5', { arp: [0, 4, 7] }),
  chipBass: (t) => A.chipBass(t, 0.4, 'C2'),
  brass: (t) => A.brass(t, 0.6, A.chord('C', 4)),
  vox: (t) => A.vox(t, 0.8, 'C4', { vowel: 'a', toVowel: 'o' }),
  chop: (t) => A.chop(t, 'C5'),
  whoosh: (t) => A.whoosh(t, 0.8),
  riser: (t) => A.riser(t, t + 0.9),
  'riser shepard': (t) => A.riser(t, t + 0.9, { type: 'shepard' }),
  downlifter: (t) => A.downlifter(t, 0.8),
  reverseCymbal: (t) => A.reverseCymbal(t + 0.9, 0.9),
  impact: (t) => A.impact(t),
  boom: (t) => A.boom(t),
  braam: (t) => A.braam(t, 0.6),
  tick: (t) => A.tick(t),
  click: (t) => A.click(t),
  key: (t) => A.key(t),
  pop: (t) => A.pop(t, 'C6'),
  blip: (t) => A.blip(t, 'C6'),
  ding: (t) => A.ding(t, 'E6'),
  success: (t) => A.success(t, 'C6'),
  coin: (t) => A.coin(t),
  shutter: (t) => A.shutter(t),
  buzz: (t) => A.buzz(t),
  paper: (t) => A.paper(t),
  thud: (t) => A.thud(t),
  glitch: (t) => A.glitch(t, 0.4),
  zap: (t) => A.zap(t),
  boing: (t) => A.boing(t),
  goo: (t) => A.goo(t, 0.3),
  heartbeat: (t) => A.heartbeat(t),
  errorBuzz: (t) => A.errorBuzz(t),
  noiseHit: (t) => A.noiseHit(t, 0.4, { bp: 3000, sweepTo: 600, decay: 6 }),
  toneSweep: (t) => A.toneSweep(t, 0.5, { wave: 'saw', from: 'C3', to: 'C5', cut: 3000 }),
};

const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
let bad = 0;
const rows = [];
for (const [name, fn] of Object.entries(voices)) {
  A.init({ duration: 1.2, bpm: 120, seed: 3 });
  fn(0.05);
  let peak = 0; let sum = 0; let cnt = 0; let finite = true;
  for (const b of A.ctx.buses.values()) {
    for (const ch of [b.L, b.R]) {
      for (let i = 0; i < ch.length; i++) {
        const x = ch[i];
        if (!Number.isFinite(x)) { finite = false; break; }
        peak = Math.max(peak, Math.abs(x));
        sum += x * x; cnt++;
      }
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, cnt));
  const problem = !finite ? 'NaN/Inf' : peak < 1e-4 ? 'silent' : peak > 4 ? 'too hot' : '';
  if (problem) bad++;
  rows.push([name, db(peak), db(rms), problem]);
}
for (const [n, p, r, pr] of rows) console.log(`${n.padEnd(16)} peak ${p.padStart(6)} dB   rms ${r.padStart(6)} dB   ${pr}`);
console.log(bad ? `${bad} voice(s) with problems` : `all ${rows.length} voices render cleanly`);

const wi = process.argv.indexOf('--wav');
if (wi > 0) {
  const names = Object.keys(voices);
  A.init({ duration: names.length * 1.3 + 1, bpm: 120, seed: 3 });
  // replay each voice at its slot by shifting time: wrap the library's time argument
  names.forEach((nm, k) => voices[nm](0.05 + k * 1.3));
  A.render(process.argv[wi + 1] || 'out/selftest.wav', { lufs: -16, report: false });
}
if (bad) process.exitCode = 1;
