// The footage screen: one WebGL2 canvas under every scene. Scenes that show the person's footage or photos draw
// layers into it (pass A, an offscreen buffer), then one effects pass writes the canvas (pass B): zoom blur, RGB
// split, glitch slices, VHS, a CRT squeeze, a spotlight, a flash, a grade. Every input is a function of t, so a frame
// renders the same in every worker: the frames a scene needs are decoded before the frame is drawn (a scene lists them
// in render.needs(t); window.__render awaits them). Created on first use (ctx.screen): a film without footage never
// opens a WebGL context. Frames come from tools/footage.mjs cut (js/footage.mjs); photos from assets/img.
import { W, H } from './timeline.mjs';

const VS = `#version 300 es
in vec2 a;
out vec2 v_px;
uniform vec2 u_res;
void main() {
  // a covers [-1, 1]; v_px: pixel position with the origin at the top left
  v_px = vec2((a.x * 0.5 + 0.5) * u_res.x, (0.5 - a.y * 0.5) * u_res.y);
  gl_Position = vec4(a, 0.0, 1.0);
}`;

const GRADE = `
uniform vec4 u_g1;   // exposure (stops), contrast, saturation, colour pass (0..1: everything grey but one hue)
uniform vec4 u_g2;   // bw, invert, tint amount, crush (lift of blacks)
uniform float u_hue; // the hue the colour pass keeps, 0..1 (0 = red, 0.33 = green, 0.66 = blue)
uniform vec3 u_tint;
uniform vec4 u_sh;   // shadow tint rgb + amount
uniform vec4 u_hi;   // highlight tint rgb + amount
float hueOf(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float d = mx - min(c.r, min(c.g, c.b));
  if (d < 1e-5) return 0.0;
  float h = mx == c.r ? mod((c.g - c.b) / d, 6.0) : mx == c.g ? (c.b - c.r) / d + 2.0 : (c.r - c.g) / d + 4.0;
  return h / 6.0;
}
vec3 grade(vec3 c) {
  c *= exp2(u_g1.x);
  c = (c - 0.5) * u_g1.y + 0.5;
  c = max(c, 0.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(c.r, max(c.g, c.b));
  float s = mx > 0.0 ? (mx - min(c.r, min(c.g, c.b))) / mx : 0.0;
  float dh = abs(fract(hueOf(c) - u_hue + 0.5) - 0.5);
  float hit = smoothstep(0.09, 0.03, dh) * smoothstep(0.18, 0.4, s);
  float keep = mix(1.0, hit, u_g1.w);
  float sat = u_g1.z * keep * (1.0 + 0.35 * u_g1.w * hit);
  c = mix(vec3(l), c, sat);
  c = mix(c, vec3(l), u_g2.x);
  c += u_sh.rgb * u_sh.a * (1.0 - smoothstep(0.0, 0.6, l)) + u_hi.rgb * u_hi.a * smoothstep(0.35, 1.0, l);
  c = mix(c, c * u_tint, u_g2.z);
  c = max(c - u_g2.w, 0.0) / (1.0 - u_g2.w);
  c = mix(c, 1.0 - c, u_g2.y);
  return clamp(c, 0.0, 1.0);
}`;

const FS_LAYER = `#version 300 es
precision highp float;
in vec2 v_px;
out vec4 o;
uniform sampler2D u_tex;
uniform sampler2D u_tex2;
uniform float u_mix;       // blend towards u_tex2 (frame blending in slow motion)
uniform mat3 u_m;          // screen px -> texture uv (homogeneous)
uniform float u_op;
uniform float u_clampOut;  // 1: outside the texture repeats its edge; 0: transparent
uniform float u_feather;   // soft edge in uv units (screen-in-screen)
uniform vec4 u_mask;       // optional box mask in uv: x0, y0, x1, y1 (only when u_useMask = 1)
uniform float u_useMask;
${GRADE}
void main() {
  vec3 q = u_m * vec3(v_px, 1.0);
  vec2 uv = q.xy / q.z;
  vec4 c = texture(u_tex, clamp(uv, 0.0, 1.0));
  if (u_mix > 0.0) c = mix(c, texture(u_tex2, clamp(uv, 0.0, 1.0)), u_mix);
  c.rgb = grade(c.rgb);
  float a = c.a * u_op;
  if (u_clampOut < 0.5) {
    vec2 e = u_feather > 0.0 ? smoothstep(vec2(0.0), vec2(u_feather), uv) * smoothstep(vec2(0.0), vec2(u_feather), 1.0 - uv)
                             : step(vec2(0.0), uv) * step(uv, vec2(1.0));
    a *= e.x * e.y;
  }
  if (u_useMask > 0.5) {
    vec2 e = step(u_mask.xy, uv) * step(uv, u_mask.zw);
    a *= e.x * e.y;
  }
  o = vec4(c.rgb * a, a);
}`;

const FS_FX = `#version 300 es
precision highp float;
in vec2 v_px;
out vec4 o;
uniform sampler2D u_src;
uniform vec2 u_res;
uniform float u_seed;
uniform vec3 u_zb;      // zoom blur: centre x, y (px), strength (0 = off; 0.1 = 10 % towards the centre)
uniform vec4 u_rgb;     // RGB split: amount px, angle (rad), radial (0/1), -
uniform vec4 u_glitch;  // amount 0..1, slice height px, seed, -
uniform vec4 u_vhs;     // amount, vertical squash, band position 0..1, -
uniform vec4 u_crt;     // squeeze x (1 = full width), squeeze y (1 = full height), glow, scanlines
uniform vec4 u_spot;    // spotlight: centre x, y (px), radius px, strength
uniform vec2 u_flash;   // white add, black fade
${GRADE}
float h1(float n) { return fract(sin(n * 12.9898 + u_seed * 78.233) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 17.13) * 43758.5453); }
vec3 fetch(vec2 p, vec2 dir) {
  // one position, the three channels pulled apart along dir; zoom blur along the ray to the centre
  int n = u_zb.z > 0.0005 ? 14 : 1;
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 14; k++) {
    if (k >= n) break;
    float f = n == 1 ? 0.0 : float(k) / float(n - 1);
    vec2 q = u_zb.xy + (p - u_zb.xy) * (1.0 - u_zb.z * f);
    vec2 uvR = vec2((q.x + dir.x) / u_res.x, 1.0 - (q.y + dir.y) / u_res.y);
    vec2 uvG = vec2(q.x / u_res.x, 1.0 - q.y / u_res.y);
    vec2 uvB = vec2((q.x - dir.x) / u_res.x, 1.0 - (q.y - dir.y) / u_res.y);
    acc += vec3(texture(u_src, uvR).r, texture(u_src, uvG).g, texture(u_src, uvB).b);
  }
  return acc / float(n);
}
void main() {
  vec2 p = v_px;
  // CRT squeeze (power on / off): the picture collapses to a line, then to a dot
  vec2 ctr = u_res * 0.5;
  p = ctr + (p - ctr) / vec2(max(u_crt.x, 0.0005), max(u_crt.y, 0.0005));
  float inCrt = step(abs(p.y - ctr.y), ctr.y) * step(abs(p.x - ctr.x), ctr.x);
  // VHS: squash, line jitter, a tracking band that crawls up
  if (u_vhs.x > 0.0) {
    p.y = ctr.y + (p.y - ctr.y) * (1.0 + u_vhs.y);
    float line = floor(v_px.y / 3.0);
    p.x += (h1(line) - 0.5) * 18.0 * u_vhs.x;
    float band = abs(v_px.y / u_res.y - u_vhs.z);
    p.x += smoothstep(0.08, 0.0, band) * (h1(line + 7.0) - 0.3) * 90.0 * u_vhs.x;
  }
  // glitch: some horizontal slices jump sideways
  float gl = 0.0;
  if (u_glitch.x > 0.0) {
    float sl = floor(v_px.y / max(u_glitch.y, 4.0));
    float r = h1(sl + u_glitch.z * 13.0);
    if (r < u_glitch.x * 0.55) { gl = 1.0; p.x += (h1(sl * 3.1 + u_glitch.z) - 0.5) * 360.0 * u_glitch.x; }
  }
  vec2 dir = vec2(cos(u_rgb.y), sin(u_rgb.y)) * u_rgb.x;
  if (u_rgb.z > 0.5) dir = (p - ctr) / length(u_res) * u_rgb.x * 2.0;
  dir += vec2(gl * 24.0 * u_glitch.x, 0.0);
  if (u_vhs.x > 0.0) dir += vec2(6.0 * u_vhs.x, 0.0);
  vec3 c = fetch(p, dir);
  c = grade(c);
  if (u_vhs.x > 0.0) {
    float band = abs(v_px.y / u_res.y - u_vhs.z);
    c += (h2(v_px * 0.5 + u_seed) - 0.5) * 0.25 * u_vhs.x + smoothstep(0.03, 0.0, band) * 0.35 * u_vhs.x * h2(v_px);
    c *= 1.0 - 0.18 * u_vhs.x * step(0.5, fract(v_px.y / 4.0));
  }
  if (u_spot.w > 0.0) {
    float d = length(v_px - u_spot.xy) / u_spot.z;
    c *= 1.0 - u_spot.w * smoothstep(0.55, 1.35, d);
  }
  if (u_crt.w > 0.0) c *= 1.0 - u_crt.w * 0.35 * step(0.5, fract(v_px.y / 3.0));
  c += u_crt.z * vec3(0.9, 0.95, 1.0);
  c = mix(c, vec3(1.0), clamp(u_flash.x, 0.0, 1.0));
  c *= 1.0 - clamp(u_flash.y, 0.0, 1.0);
  o = vec4(c * inCrt, 1.0);
}`;

/**
 * A grade, every field optional: exposure (stops), contrast, saturation, bw (0..1), invert, crush (lift of blacks),
 * tint [r, g, b] with tintAmt, sh / hi [r, g, b, amount] (shadow and highlight colour — teal shadows and warm
 * highlights: sh [0, 0.05, 0.1, 0.3], hi [0.1, 0.05, 0, 0.3]), pass (0..1) with passHue (degrees): everything grey
 * but that hue — the brand's colour, a red coat.
 */
export const GRADE_DEFAULT = { exposure: 0, contrast: 1, saturation: 1, pass: 0, passHue: 0, bw: 0, invert: 0, tintAmt: 0, crush: 0, tint: [1, 1, 1], sh: [0, 0, 0, 0], hi: [0, 0, 0, 0] };

/** 3×3 matrices, row-major (transposed on upload). */
export const mat = {
  id: () => [1, 0, 0, 0, 1, 0, 0, 0, 1],
  mul: (a, b) => {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  },
  inv: (m) => {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h; const B = -(d * i - f * g); const C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  },
  /** Homography mapping the unit square (0,0),(1,0),(1,1),(0,1) to the quad p0..p3 (a frame on a phone, a poster on a wall). */
  square2quad: ([p0, p1, p2, p3]) => {
    const [x0, y0] = p0; const [x1, y1] = p1; const [x2, y2] = p2; const [x3, y3] = p3;
    const dx1 = x1 - x2; const dx2 = x3 - x2; const dy1 = y1 - y2; const dy2 = y3 - y2;
    const sx = x0 - x1 + x2 - x3; const sy = y0 - y1 + y2 - y3;
    let g = 0; let h = 0;
    if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
      const den = dx1 * dy2 - dx2 * dy1;
      g = (sx * dy2 - dx2 * sy) / den;
      h = (dx1 * sy - sx * dy1) / den;
    }
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
  },
  apply: (m, x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; },
};

/**
 * A view of a source image of (sw, sh) px on the W×H screen: the source point (cx, cy) (0..1) lands on the screen point
 * (px, py) (default the centre), scaled by z relative to "cover" (1 = the source just covers the screen), rotated r
 * degrees. → { m: screen px → uv for draw(), fwd: source px → screen px, k: screen px per source px, css: a CSS
 * matrix() to put DOM elements (text, a cursor) on the same picture }.
 */
export function view({ sw = W, sh = H, z = 1, cx = 0.5, cy = 0.5, px = W / 2, py = H / 2, r = 0 } = {}) {
  const k = Math.max(W / sw, H / sh) * z;
  const c = Math.cos((r * Math.PI) / 180);
  const s = Math.sin((r * Math.PI) / 180);
  const fwd = [k * c, -k * s, 0, k * s, k * c, 0, 0, 0, 1];
  const ox = cx * sw; const oy = cy * sh;
  fwd[2] = px - (fwd[0] * ox + fwd[1] * oy);
  fwd[5] = py - (fwd[3] * ox + fwd[4] * oy);
  return { m: mat.mul([1 / sw, 0, 0, 0, 1 / sh, 0, 0, 0, 1], mat.inv(fwd)), fwd, k, css: `matrix(${fwd[0]},${fwd[3]},${fwd[1]},${fwd[4]},${fwd[2]},${fwd[5]})` };
}

export class Screen {
  constructor(stage) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    // first in the stage at z 0: every scene's DOM (type, UI, stickers) paints over the footage
    Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', width: `${W}px`, height: `${H}px`, zIndex: '0', display: 'none' });
    stage.prepend(cv);
    this.canvas = cv;
    const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser — footage scenes need it');
    this.gl = gl;
    this.progL = this.program(VS, FS_LAYER);
    this.progF = this.program(VS, FS_FX);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    for (const p of [this.progL, this.progF]) {
      const loc = gl.getAttribLocation(p, 'a');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    // pass A target
    this.fboTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.cache = new Map(); // url -> { tex, used, w, h }
    this.tick = 0;
    this.maxTex = 24; // a frame, its neighbour for blending, the other layers — times the render's workers
    this.uni = new Map();
  }

  program(vs, fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  u(p, name) {
    const key = `${p === this.progL ? 'L' : 'F'}:${name}`;
    if (!this.uni.has(key)) this.uni.set(key, this.gl.getUniformLocation(p, name));
    return this.uni.get(key);
  }

  /** Decodes and uploads every url in the list that is not cached yet (awaited before the frame is drawn). */
  async prepare(urls) {
    const gl = this.gl;
    this.tick++;
    const jobs = [];
    for (const url of new Set(urls)) {
      const hit = this.cache.get(url);
      if (hit) { hit.used = this.tick; continue; }
      jobs.push((async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`[screen] cannot load ${url} — run tools/footage.mjs cut, or check the path`);
        const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.cache.set(url, { tex, used: this.tick, w: bmp.width, h: bmp.height });
        bmp.close();
      })());
    }
    await Promise.all(jobs);
    if (this.cache.size > this.maxTex) {
      const old = [...this.cache.entries()].sort((a, b) => a[1].used - b[1].used);
      for (const [url, e] of old.slice(0, this.cache.size - this.maxTex)) {
        if (e.used === this.tick) continue;
        gl.deleteTexture(e.tex);
        this.cache.delete(url);
      }
    }
  }

  has(url) { return this.cache.has(url); }
  /** [w, h] of a decoded image, or null. */
  size(url) { const e = this.cache.get(url); return e ? [e.w, e.h] : null; }

  show(on) { const d = on ? '' : 'none'; if (this.canvas.style.display !== d) this.canvas.style.display = d; }

  /** Starts a frame (the reel calls it): pass A is cleared to `bg` (rgb 0..1). */
  begin(bg = [0, 0, 0]) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, W, H);
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(this.vao);
    this.layers = 0;
  }

  setGrade(p, g = {}) {
    const gl = this.gl;
    const q = { ...GRADE_DEFAULT, ...g };
    gl.uniform4f(this.u(p, 'u_g1'), q.exposure, q.contrast, q.saturation, q.pass);
    gl.uniform4f(this.u(p, 'u_g2'), q.bw, q.invert, q.tintAmt, q.crush);
    gl.uniform1f(this.u(p, 'u_hue'), (((q.passHue % 360) + 360) % 360) / 360);
    gl.uniform3f(this.u(p, 'u_tint'), ...q.tint);
    gl.uniform4f(this.u(p, 'u_sh'), ...q.sh);
    gl.uniform4f(this.u(p, 'u_hi'), ...q.hi);
  }

  /**
   * Draws one layer into pass A. m: screen px → uv (view().m, or a homography for a picture on a surface). Options: op
   * (opacity), blend ('normal' | 'screen' | 'add' | 'max'), grade {…}, next + mix (blend towards the next frame: smooth
   * slow motion), clampOut (repeat the edge outside the image), feather (soft edge in uv), mask [x0, y0, x1, y1] in uv.
   * Returns false when the image was not prepared (list it in render.needs).
   */
  draw(url, m, o = {}) {
    const gl = this.gl;
    const e = this.cache.get(url);
    if (!e) return false;
    const p = this.progL;
    gl.useProgram(p);
    gl.uniform2f(this.u(p, 'u_res'), W, H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, e.tex);
    gl.uniform1i(this.u(p, 'u_tex'), 0);
    const n = o.next && this.cache.get(o.next);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, n ? n.tex : e.tex);
    gl.uniform1i(this.u(p, 'u_tex2'), 1);
    gl.uniform1f(this.u(p, 'u_mix'), n ? (o.mix || 0) : 0);
    gl.uniformMatrix3fv(this.u(p, 'u_m'), true, new Float32Array(m));
    gl.uniform1f(this.u(p, 'u_op'), o.op ?? 1);
    gl.uniform1f(this.u(p, 'u_clampOut'), o.clampOut ? 1 : 0);
    gl.uniform1f(this.u(p, 'u_feather'), o.feather || 0);
    gl.uniform1f(this.u(p, 'u_useMask'), o.mask ? 1 : 0);
    gl.uniform4f(this.u(p, 'u_mask'), ...(o.mask || [0, 0, 1, 1]));
    this.setGrade(p, o.grade);
    gl.enable(gl.BLEND);
    const blend = o.blend || 'normal';
    gl.blendEquation(blend === 'max' ? gl.MAX : gl.FUNC_ADD);
    if (blend === 'screen') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    else if (blend === 'add' || blend === 'max') gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    this.layers++;
    return true;
  }

  /**
   * Pass B (the reel calls it with ctx.gl): effects from pass A onto the canvas, every field optional — zb [x, y,
   * strength] zoom blur, rgb (px) + rgbAngle (rad) or rgbRadial, glitch (0..1) + glitchH (slice px) + glitchSeed, vhs
   * (0..1) + vhsSquash + vhsBand, crtX / crtY (squeeze, 1 = full) + crtGlow + scan, spot [x, y, radius, strength],
   * flash (white), fade (black), grade {…}, seed.
   */
  end(fx = {}) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    const p = this.progF;
    gl.useProgram(p);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.uniform1i(this.u(p, 'u_src'), 0);
    gl.uniform2f(this.u(p, 'u_res'), W, H);
    gl.uniform1f(this.u(p, 'u_seed'), fx.seed || 0);
    gl.uniform3f(this.u(p, 'u_zb'), ...(fx.zb || [W / 2, H / 2, 0]));
    gl.uniform4f(this.u(p, 'u_rgb'), fx.rgb || 0, fx.rgbAngle || 0, fx.rgbRadial ? 1 : 0, 0);
    gl.uniform4f(this.u(p, 'u_glitch'), fx.glitch || 0, fx.glitchH || 60, fx.glitchSeed || 0, 0);
    gl.uniform4f(this.u(p, 'u_vhs'), fx.vhs || 0, fx.vhsSquash || 0, fx.vhsBand ?? 0.5, 0);
    gl.uniform4f(this.u(p, 'u_crt'), fx.crtX ?? 1, fx.crtY ?? 1, fx.crtGlow || 0, fx.scan || 0);
    gl.uniform4f(this.u(p, 'u_spot'), ...(fx.spot || [W / 2, H / 2, W, 0]));
    gl.uniform2f(this.u(p, 'u_flash'), fx.flash || 0, fx.fade || 0);
    this.setGrade(p, fx.grade);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
