// Boot: wait for the page, load every font (scenes measure text while they build), build the scenes, then expose the
// capture protocol: window.__render(t, frame), window.__samples(t), window.__ready.
const stage = document.getElementById('stage');
const params = new URLSearchParams(location.search);
const debug = params.has('debug');
if (debug) document.body.classList.add('debug');

const { W, H, BEAT, WHIPS, S, FPS = 60, DURATION, LOOP } = await import('./timeline.mjs');
for (const e of [document.body, stage]) Object.assign(e.style, { width: `${W}px`, height: `${H}px` });

if (document.readyState !== 'complete') await new Promise((r) => addEventListener('load', r, { once: true }));
// Every @font-face of css/fonts.css, loaded up front: a missing file shows up in the capture log, not as a silent fallback.
await Promise.all([...document.fonts].map((f) => f.load().catch(() => console.warn(`[fonts] cannot load ${f.family} ${f.weight} ${f.style} — check css/fonts.css`))));
await document.fonts.ready;

await import('./i18n.js');
const { buildReel } = await import('./reel.js');
const renderFn = await buildReel(stage, params);
const { nextFrame } = await import('./engine.js');

// A character its fonts lack is drawn by a system font and looks pasted in (a ₽ or an arrow in a face without one), or
// as a box when no font has it. Each text is measured in the web fonts of its own stack with three different fallbacks
// behind them: a character they have measures the same every time; a missing one measures as the fallback alone does,
// or draws exactly like a code point no font has. Render functions write text too (counters, scrambles), so the check
// runs at several moments of every scene.
const WEB_FONTS = new Set([...document.fonts].map((f) => f.family.replace(/^["']|["']$/g, '')));
const glyphProbe = document.createElement('canvas');
glyphProbe.width = glyphProbe.height = 96;
const gp = glyphProbe.getContext('2d', { willReadFrequently: true });
const NO_GLYPH = String.fromCodePoint(0x10fffd);
const FALLBACKS = ['monospace', 'serif', 'cursive'];
const width = (font, ch) => { gp.font = font; return gp.measureText(ch).width; };
const ink = (font, ch) => { gp.clearRect(0, 0, 96, 96); gp.font = font; gp.fillText(ch, 8, 72); return gp.getImageData(0, 0, 96, 96).data; };
const sameInk = (a, b) => { for (let i = 3; i < a.length; i += 4) if (a[i] !== b[i]) return false; return true; };
const glyphSeen = new Map();
const glyphGaps = new Map();
function checkGlyphs() {
  for (const e of stage.querySelectorAll('*')) {
    let own = '';
    for (const n of e.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.replace(/[\s\p{M}\p{Cf}\p{Extended_Pictographic}]/gu, '');
    if (!own) continue;
    const cs = getComputedStyle(e);
    if (cs.textTransform === 'uppercase') own = own.toUpperCase();
    else if (cs.textTransform === 'lowercase') own = own.toLowerCase();
    else if (cs.textTransform === 'capitalize') own += own.toUpperCase();
    // the web fonts that lead the stack; a system family behind them ('Arial Black') is a fallback, not a choice
    const fams = [];
    for (const f of cs.fontFamily.split(',').map((x) => x.trim())) { if (!WEB_FONTS.has(f.replace(/^["']|["']$/g, ''))) break; fams.push(f); }
    if (!fams.length) continue;
    const stack = fams.join(', ');
    const style = `${cs.fontStyle} ${cs.fontWeight} 64px`;
    for (const ch of new Set(own)) {
      const key = `${style}|${stack}|${ch}`;
      if (glyphSeen.has(key)) continue;
      const inFont = FALLBACKS.map((f) => width(`${style} ${stack}, ${f}`, ch));
      const alone = FALLBACKS.map((f) => width(`${style} ${f}`, ch));
      let missing = inFont.some((w) => w !== inFont[0]) || inFont.every((w, i) => w === alone[i]);
      const font = `${style} ${stack}, serif`;
      if (!missing && inFont[1] === width(font, NO_GLYPH)) missing = sameInk(ink(font, ch), ink(font, NO_GLYPH));
      glyphSeen.set(key, missing);
      if (missing) (glyphGaps.get(fams[0]) ?? glyphGaps.set(fams[0], new Set()).get(fams[0])).add(ch);
    }
  }
}

// The video never numbers itself: a scene counter or a chapter label ("01 / 06", "SCENE 03", "step 1 of 4") reads as
// a template. Found at the same moments, warned below and failed by tools/qa.mjs (it reads window.__lint).
const COUNTER = /^(?:(?:scene|chapter|part|step|shot|ch\.?|сцена|глава|часть|шаг|кадр)\s*)?(\d{1,2})\s*(?:\/|\||⁄|∕|of|из|—|–)\s*(\d{1,2})$/iu;
const LABEL = /^(?:scene|chapter|part|shot|сцена|глава|часть|кадр)\s*№?\s*\d{1,2}$/iu;
window.__lint = [];
function checkCounters(t) {
  for (const e of stage.querySelectorAll('*')) {
    const text = e.textContent.replace(/\s+/g, ' ').trim();
    if (!text || text.length > 24) continue;
    const m = COUNTER.exec(text);
    const counter = (m && Number(m[1]) <= Number(m[2]) && Number(m[2]) <= 24) || LABEL.test(text);
    if (counter && !window.__lint.some((l) => l.text === text)) window.__lint.push({ kind: 'counter', text, t: Math.round(t * 100) / 100 });
  }
}

// Text cut by the edge of the frame: a word that sits partly outside at a settled moment of a scene (one flying in or
// out, wholly off the frame, is left alone). Warned in the capture log; tools/qa.mjs reports it.
function checkOverflow(t) {
  for (const e of stage.querySelectorAll('*')) {
    let own = '';
    for (const n of e.childNodes) if (n.nodeType === 3) own += n.textContent;
    if (own.trim().length < 2) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    let o = 1; // what the eye gets: a word inside a faded-out group is not on screen
    for (let a = e; a && a !== stage; a = a.parentElement) o *= Number(getComputedStyle(a).opacity);
    if (o < 0.05) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const inside = r.right > 0 && r.x < W && r.bottom > 0 && r.y < H; // wholly off the frame: on its way in or out
    const over = Math.max(-r.x, -r.y, r.right - W, r.bottom - H);
    if (over > 8 && inside) {
      const text = own.replace(/\s+/g, ' ').trim().slice(0, 40);
      if (!window.__lint.some((l) => l.kind === 'overflow' && l.text === text)) window.__lint.push({ kind: 'overflow', text, t: Math.round(t * 100) / 100, px: Math.round(over) });
    }
  }
}

window.__samples = (t) => (WHIPS.some(([a, z]) => t >= a && t <= z) ? 16 : 8);

window.__render = async (t, f) => {
  // a loop: the motion-blur samples of frame 0 (t < 0) come from the end, those of the last frame from the start —
  // without this the seam frame blurs into an empty stage and blinks
  if (LOOP && DURATION > 0) t = ((t % DURATION) + DURATION) % DURATION;
  // footage frames and photos on the screen are decoded before the frame is drawn
  if (renderFn.prepare) await renderFn.prepare(t, f);
  nextFrame();
  renderFn(t, f);
  if (debug) document.getElementById('debug').textContent = `${t.toFixed(2)} s · beat ${(t / BEAT).toFixed(2)} · bar ${Math.floor(t / BEAT / 4) + 1}`;
  // captureScreenshot draws a fresh frame itself; this wait only lets images and fonts settle (timer fallback when
  // the compositor is throttled).
  return new Promise((r) => {
    let done = false;
    const fin = () => { if (!done) { done = true; r(); } };
    requestAnimationFrame(() => requestAnimationFrame(fin));
    setTimeout(fin, 40);
  });
};

await Promise.all([...document.images].map((im) => im.decode().catch(() => console.warn(`[img] cannot decode ${im.src}`))));
await Promise.all([...document.querySelectorAll('image')].map((im) => new Promise((r) => {
  const i = new Image();
  i.onload = r; i.onerror = () => { console.warn(`[img] cannot load ${im.getAttribute('href')}`); r(); };
  i.src = im.getAttribute('href');
})));

// the glyph and counter checks at the start, the middle and the end of every scene (frames are functions of t),
// then back to frame 0
const moments = new Set([0]);
const settled = new Set();
for (const [a, z] of Object.values(S ?? {})) for (const k of [0.15, 0.5, 0.85]) { moments.add(a + (z - a) * k); if (k > 0.3) settled.add(a + (z - a) * k); }
for (const t of [...moments].sort((x, y) => x - y)) { nextFrame(); renderFn(t, Math.round(t * FPS)); checkGlyphs(); checkCounters(t); if (settled.has(t)) checkOverflow(t); }
for (const [family, chars] of glyphGaps) {
  const show = (c) => (/[\p{L}\p{N}\p{P}\p{S}]/u.test(c) ? `"${c}"` : `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
  const list = [...chars].slice(0, 12).map(show).join(' ') + (chars.size > 12 ? ' …' : '');
  console.warn(`[fonts] ${family} has no glyph for ${list} — another font draws it, or a box; use a font that has it, or another character`);
}
for (const l of window.__lint.filter((x) => x.kind === 'counter')) console.warn(`[template] a scene counter "${l.text}" at ${l.t} s — the video never numbers its own scenes: remove it (story-and-motion.md §9)`);
for (const l of window.__lint.filter((x) => x.kind === 'overflow')) console.warn(`[layout] "${l.text}" is cut ${l.px} px by the edge of the frame at ${l.t} s — fitFont() it, or move it inside`);
nextFrame();
renderFn(0, 0);
window.__ready = true;
