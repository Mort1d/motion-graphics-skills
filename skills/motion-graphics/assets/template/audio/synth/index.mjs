// The synth, in one import:  import * as A from './synth/index.mjs'  (or pick names).
// core    init, bus, beats, bars, note, hz, rand, between, trigger, oscillators, filters, shapers
// theory  scale, chord, prog, voiceLead, harmony, steps, seq
// drums   kick, snare, clap, rim, snap, hat, ride, crash, shaker, tom, conga, clave, cowbell, roll
// tonal   bass808, bassLine, sub, reese, acid, houseBass, fmBass, supersaw, stab, pad, pluck, keys, bell, lead,
//         chip, chipBass, brass, vox, chop, arp
// fx      whoosh, swish, riser, downlifter, reverseCymbal, impact, boom, braam, tick, click, key, pop, blip, ding,
//         success, sparkle, coin, shutter, buzz, paper, thud, glitch, zap, boing, goo, heartbeat, errorBuzz,
//         noiseHit, toneSweep
// mix     gap, tapeStop, stutter, automate, render, loudness, truePeak
// sample  sample (a recorded WAV, its loudest moment on t), readWav, peakOf
export * from './core.mjs';
export * from './theory.mjs';
export * from './drums.mjs';
export * from './tonal.mjs';
export * from './fx.mjs';
export * from './mix.mjs';
export * from './sample.mjs';
