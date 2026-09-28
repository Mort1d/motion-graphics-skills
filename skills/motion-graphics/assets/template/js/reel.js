// Scene assembly. Each js/scenes/<name>.js exports build(ctx) → (t, frame) => void, called for every frame; a scene
// hides itself outside its window (js/timeline.mjs S). ?only=hook,lockup builds a subset (faster previews).
// ctx: { stage, fx (2D canvas above every scene, cleared each frame — sparks, streaks) }.
import { W, H } from './timeline.mjs';

export const SCENES = ['hook', 'proof', 'lockup', 'post']; // @template-demo — your scenes, in story order ('post' last)

export async function buildReel(stage, params) {
  const fx = document.createElement('canvas');
  fx.width = W;
  fx.height = H;
  Object.assign(fx.style, { position: 'absolute', left: '0', top: '0', zIndex: '40', pointerEvents: 'none' });
  const ctx = { stage, fx: fx.getContext('2d') };
  const only = params.get('only')?.split(',');
  const scenes = [];
  for (const name of SCENES) {
    if (only && !only.includes(name) && name !== 'post') continue;
    const m = await import(`./scenes/${name}.js`);
    scenes.push(await m.build(ctx));
  }
  stage.appendChild(fx);
  return (t, f) => {
    ctx.fx.clearRect(0, 0, W, H);
    for (const s of scenes) s(t, f);
  };
}
