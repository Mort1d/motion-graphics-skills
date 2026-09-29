// Scene assembly. Each js/scenes/<name>.js exports build(ctx) → (t, frame) => void, called for every frame; a scene
// hides itself outside its window (js/timeline.mjs S). ?only=hook,lockup builds a subset (faster previews).
// ctx: { stage, fx (2D canvas above every scene, cleared each frame — sparks, streaks), screen (the WebGL footage
// screen under every scene, js/screen.js — created the first time a scene reads it), gl (this frame's effects for the
// screen: a scene that draws on it sets ctx.gl.used and any field of Screen.end) }. A scene that draws images on
// the screen lists them in render.needs(t, frame): they are decoded before the frame is drawn.
import { W, H } from './timeline.mjs';
import { Screen } from './screen.js';

export const SCENES = ['hook', 'proof', 'lockup', 'post']; // @template-demo — your scenes, in story order ('post' last)

export async function buildReel(stage, params) {
  const fx = document.createElement('canvas');
  fx.width = W;
  fx.height = H;
  Object.assign(fx.style, { position: 'absolute', left: '0', top: '0', zIndex: '40', pointerEvents: 'none' });
  let screen = null;
  const ctx = { stage, fx: fx.getContext('2d'), gl: {}, get screen() { return (screen ??= new Screen(stage)); } };
  const only = params.get('only')?.split(',');
  const scenes = [];
  for (const name of SCENES) {
    if (only && !only.includes(name) && name !== 'post') continue;
    const m = await import(`./scenes/${name}.js`);
    scenes.push(await m.build(ctx));
  }
  stage.appendChild(fx);
  const render = (t, f) => {
    ctx.fx.clearRect(0, 0, W, H);
    ctx.gl = {};
    screen?.begin();
    for (const s of scenes) s(t, f);
    if (screen) { if (ctx.gl.used) { screen.end(ctx.gl); screen.show(true); } else screen.show(false); }
  };
  render.prepare = async (t, f) => {
    const urls = scenes.flatMap((s) => (s.needs ? s.needs(t, f) : []));
    if (urls.length) await ctx.screen.prepare(urls);
  };
  return render;
}
