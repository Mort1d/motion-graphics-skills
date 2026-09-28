// Finishing over every scene: a vignette. (Film grain is added at encode time by tools/render.mjs.)
import { el } from '../engine.js';

export async function build(ctx) {
  el('div', 'vignette', ctx.stage);
  return () => {};
}
