// @template-demo — THE DEMO SCORE. It exists so the pipeline runs end to end; it is not a starting point. Every video
// gets its own score, written from its own sound brief (references/sound-design.md): its own genre, tempo, key,
// drum kit, bass, harmony, hook and brand-world sounds. Delete this file's body and compose.
// Take its structure (one harmony table, SFX from the CUEs, a gap before the logo, a tail), not its sound: house with
// a kick on every beat at 120–128 is what every generated promo already sounds like. tools/audio-check.mjs and the
// render's QA compare your score with this one and with the promos next to this project.
//
// Sound brief (demo): punchy tech-house, 120 BPM, F minor. Intro without drums under the hook (filtered pad opening,
// a hit per word), the drop on the cards (four-on-the-floor, rolling bass, off-beat stabs), a beat of silence before
// the logo, a three-note bell motif as the sonic logo, a last hit that rings out under the end card.
//   node audio/score.mjs [out/music.wav] [--lang en] [--report]
import * as A from './synth/index.mjs';
import { BPM, DURATION, CUE, S, b } from '../js/timeline.mjs';
import { COPY, DEFAULT_LANG } from '../js/copy.mjs';

const args = process.argv.slice(2);
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : DEFAULT_LANG;
const TX = COPY[lang] || COPY[DEFAULT_LANG];
const out = args.find((a, i) => a.endsWith('.wav') && args[i - 1] !== '--lang') || (lang === DEFAULT_LANG ? 'out/music.wav' : `out/music-${lang}.wav`);

A.init({ duration: DURATION, bpm: BPM, seed: 7 });
A.bus('drums', { gain: -2 });
A.bus('bass', { gain: -5, duck: 0.55 });
A.bus('music', { gain: -6, duck: 0.4, verb: 0.2 });
A.bus('lead', { gain: -7, verb: 0.2, delay: 0.25 });
A.bus('fx', { gain: -5, verb: 0.15 });

// ---- harmony: one table drives bass, stabs, pad and arp ------------------------------------------------------------------
const H = A.harmony([[0, 'Fm9'], [8, 'Fm9'], [10, 'Dbmaj7'], [12, 'Bbm9'], [14, 'C7sus4'], [16, 'Fm9'], [18, 'Dbmaj7'], [20, 'Ebsus2'], [22, 'Fm9']], { oct: 4 });

// ---- intro: the hook (no drums) ------------------------------------------------------------------------------------------
A.pad(0, b(8), A.voiceLead([H.at(0)])[0], { type: 'warm', attack: 1.2 });
A.automate('music', 'lp', [[0, 420], [b(4), 900], [b(7.8), 3200], [b(8), 12000]]);
A.tick(CUE.line, { bright: 6000, vel: 0.6 });
A.toneSweep(CUE.line, 0.45, { from: 'F5', to: 'F6', wave: 'sine', env: 'swell', vel: 0.25, verb: 0.3 });
[CUE.w1, CUE.w2, CUE.w3].forEach((t, i) => {
  A.whoosh(t - 0.28, 0.28, { shape: 'in', f0: 400, f1: 5000, pan: [0, 0], vel: 0.35 });
  A.impact(t, { vel: 0.55 + i * 0.12, sub: 'F1', air: 0.7 });
  A.bass808(t, b(0.9), ['F1', 'F1', 'C2'][i], { drive: 2.4, vel: 0.7 });
});
for (let k = 0; k < 14; k++) A.tick(CUE.sub + k * 0.05, { bright: 4500 + (k % 4) * 700, vel: 0.35, pan: -0.4 + k * 0.06 });
A.riser(b(4), CUE.exit, { vel: 0.5 });
A.whoosh(CUE.exit - 0.05, CUE.drop - CUE.exit + 0.1, { pan: [0.8, -0.8], f0: 250, f1: 6000, vel: 0.8 });
A.reverseCymbal(CUE.drop, b(1.5), { vel: 0.5 });

// ---- the drop (beats 8–15): cards, statement ---------------------------------------------------------------------------------
const groove = (b0, b1, full) => {
  const t0 = b(b0); const t1 = b(b1);
  for (const h of A.steps('X...X...X...X...', { from: t0, to: t1 })) A.kick(h.t, { type: 'punch', vel: h.vel });
  for (const h of A.steps('....X.......X...', { from: t0, to: t1 })) A.clap(h.t, { vel: 0.7 });
  for (const h of A.steps('..X...X...X...X.', { from: t0, to: t1 })) A.hat(h.t, { open: true, decay: 0.09, vel: 0.35, pan: 0.2 });
  for (const h of A.steps('x.o.x.o.x.o.x.oo', { from: t0, to: t1, swing: 0.08 })) A.hat(h.t, { vel: 0.22 * h.vel, pan: -0.25 });
  // rolling bass on the chord roots: off-beat 16ths, an octave hop at the end of each bar
  for (const h of A.steps('..x.x.x...x.x.xX', { from: t0, to: t1 })) {
    const beat = h.t / b(1);
    const root = H.at(beat).root;
    A.houseBass(h.t, b(0.22), root - 12 + (h.vel === 1 ? 12 : 0), { vel: 0.8, bright: 0.9 });
  }
  // off-beat stabs follow the harmony
  for (const h of A.steps('..x...x...x...x.', { from: t0, to: t1 })) A.stab(h.t, H.at(h.t / b(1)), { vel: 0.5, dur: 0.12 });
  if (full) {
    for (const [a, z, ch] of H.spans(b0, b1)) A.arp(b(a), b(z), ch.map((m) => m + 12), { rate: 1 / 4, pattern: 'updown', bus: 'lead', vel: 0.55, gate: 0.6 });
  }
};
A.impact(CUE.drop, { vel: 0.9, sub: 'F1' });
A.crash(CUE.drop, { vel: 0.5 });
groove(8, 15, false);
// a whoosh + a pop per card, and ticks that follow the rolling digits (kit.roll eases out-cubic over 0.8 s)
[CUE.drop, CUE.card2, CUE.card3].forEach((t, i) => {
  A.whoosh(t - 0.12, 0.4, { pan: [0.9, 0], f0: 600, f1: 5000, vel: 0.55 });
  A.pop(t + 0.05, ['C6', 'Eb6', 'F6'][i], { vel: 0.5 });
  const n = 14;
  for (let k = 1; k <= n; k++) A.tick(t + 0.12 + 0.8 * (1 - Math.cbrt(1 - k / n)), { bright: 5000 + k * 120, vel: 0.28, pan: -0.6 + i * 0.6 });
});
[CUE.statement, CUE.statement + b(1)].forEach((t, i) => { A.impact(t, { vel: 0.6 + 0.15 * i, sub: 'G1', air: 0.6 }); A.crash(t, { vel: 0.25, dur: 1.2 }); });
A.roll(b(14), CUE.hole, (t, v) => A.snare(t, { type: 'tight', vel: v * 0.45 }), { from: 1 / 4, to: 1 / 16 });

// ---- the hole and the logo ------------------------------------------------------------------------------------------------------
A.gap(CUE.hole, CUE.logo - 0.01);
A.riser(b(13.5), CUE.logo - 0.02, { vel: 0.6, curve: 2.6 });
A.reverseCymbal(CUE.logo, b(1.6), { vel: 0.6 });
A.whoosh(CUE.logo - 0.42, 0.44, { shape: 'in', pan: [0, 0], f0: 300, f1: 7000, vel: 0.7 });
A.impact(CUE.logo, { vel: 1, sub: 'F1', air: 1.2 });
A.boom(CUE.logo, { from: 90, to: 32, vel: 0.7 });
A.crash(CUE.logo, { vel: 0.6, dur: 2.6 });
// the sonic logo: three bells, C6 – Ab5 – F5, the same motif every time the brand appears
['C6', 'Ab5', 'F5'].forEach((m, i) => A.bell(CUE.logo + i * b(0.5), m, { ratio: 2.01, index: 2.2, idec: 5, dur: 2.2, vel: 0.5, bus: 'lead', verb: 0.4 }));
groove(16, 22, true);
A.sparkle(CUE.tagline, { vel: 0.8 });
A.swish(CUE.cta, { pan: [-0.8, 0.2], vel: 0.6 });
TX.contacts.forEach((_, i) => A.pop(CUE.cta + b(0.5) * (i + 1), ['F5', 'Ab5', 'C6', 'Eb6'][i % 4], { vel: 0.45, pan: -0.5 + i * 0.5 }));

// ---- the last hit ---------------------------------------------------------------------------------------------------------------
A.kick(CUE.final, { type: 'punch', vel: 1 });
A.impact(CUE.final, { vel: 0.9, sub: 'F1' });
A.crash(CUE.final, { vel: 0.55, dur: 2 });
A.bass808(CUE.final, 1.6, 'F1', { drive: 2.8, vel: 0.8 });
A.pad(CUE.final, 1.2, A.voiceLead([H.at(22)])[0], { type: 'air', attack: 0.02, release: 1.4, vel: 0.9 });
A.bell(CUE.final + 0.02, 'F5', { ratio: 2.01, index: 2, dur: 2.4, vel: 0.45, bus: 'lead' });

A.render(out, { lufs: -14, reverb: 'plate', delay: { beats: 0.75, feedback: 0.35 }, sections: S });
