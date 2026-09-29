// ONE timeline for picture and sound. Scenes (js/scenes/*.js) and the score (audio/score.mjs) both import this file,
// so every slam, whoosh and cut lands on the same sample. Plan the story in beats; b(n) turns beats into seconds.
// @template-demo — rewrite S, ENERGY, CUE, WHIPS and COVERS for every video (keep the exports' names).
export const W = 1920; // @param width
export const H = 1080; // @param height
export const FPS = 60; // @param fps
export const BPM = 120; // @param bpm
export const BEAT = 60 / BPM;
export const BAR = 4 * BEAT;
/** Beats → seconds. */
export const b = (n) => n * BEAT;

/** Length of the video: the last hit on beat 22, then the logo holds and the tail rings out. */
export const DURATION = b(22) + 2;

/** Scene windows [start, end] in seconds. Neighbours overlap by a beat or less: that is where transitions live. */
export const S = {
  hook: [0, b(8.4)],
  proof: [b(7.6), b(16.4)],
  lockup: [b(15.8), DURATION],
};

/** How hard each scene hits, from the person's words, then the references, then the topic (SKILL.md step 3):
 *  'low' no or filtered drums · 'mid' the groove with fewer layers · 'high' the full groove (drums and bass).
 *  The score follows it; tools/audio-check.mjs and tools/qa.mjs check the mix against it. */
export const ENERGY = { hook: 'low', proof: 'high', lockup: 'high' };

/** Named moments shared by the picture and the score (seconds). */
export const CUE = {
  line: b(0.25), // a light line draws across the black
  w1: b(1), // MAKE
  w2: b(2), // IT
  w3: b(3), // MOVE.
  sub: b(4.5), // the subline decodes
  exit: b(7.4), // whip out of the hook: 0.3 s, done on the drop
  drop: b(8), // the beat drops: card 1
  card2: b(9),
  card3: b(10),
  statement: b(12), // EVERY FRAME. / EVERY BEAT.
  hole: b(15), // everything drops out for a beat…
  logo: b(16), // …the lockup slams
  tagline: b(17),
  cta: b(18),
  final: b(22), // the last hit
};

/** Fast moves: frames inside these windows get 16 motion-blur samples instead of 8. */
export const WHIPS = [
  [b(0.9), b(1.3)], [b(1.9), b(2.3)], [b(2.9), b(3.4)], [b(7.2), b(8.6)], [b(8.8), b(10.6)],
  [b(11.8), b(12.5)], [b(15.4), b(16.7)], [b(21.8), b(22.4)],
];

/** Stills saved as covers / thumbnails after the final render. */
export const COVERS = [b(3.6), b(20)];

/** true for a video that loops (X plays short videos in a loop; a site's hero): the last frame folds back into the
 *  first, the motion blur of frame 0 comes from the end, and QA checks the seam. */
export const LOOP = false;
