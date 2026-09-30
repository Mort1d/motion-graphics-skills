#!/usr/bin/env node
// Frame capture for code-driven video: a tiny static server + a headless Chromium (Chrome, Edge, Chromium or Brave)
// driven over the DevTools protocol. No npm packages: Node >= 22.4 (global WebSocket + fetch), ffmpeg on PATH.
//
// The page (index.html of the project) must expose:
//   window.__ready = true          once fonts, images and every scene are built
//   window.__render(t, frame)      draws time t (seconds) as a pure function of t; may return a Promise
//   window.__samples(t)            optional: motion-blur samples this frame wants (e.g. 16 in whip pans, else 8)
//
//   node tools/capture.mjs doctor                                   check node, ffmpeg, ffprobe and the browser
//   node tools/capture.mjs still 0.5 3 7.25 [--out out/stills]      full-size PNG stills at a list of times (no blur)
//   node tools/capture.mjs sheet 0 12 24 [--cols 6] [--scale 0.25]  contact sheet: 24 frames from 0 s to 12 s (--clean: no time label)
//   node tools/capture.mjs review [--out out/review]                  the critique set: a frame per beat, the phone view, fast-move strips
//   node tools/capture.mjs verify [--n 12]                           the same frames in any order? (determinism)
//   times are seconds, or beats with a b suffix: still 16b 16.5b, sheet 0b 32b 24
//   node tools/capture.mjs render --from 0 --to 4 [--out out/part.mp4] [--sub 16] [--scale 1]
//   node tools/capture.mjs eval "<js expression>" [--times 3.5,4]   render those times, print the expression's value
// Common flags: --query "lang=en&only=hook" (passed to the page), --debug (time overlay in stills/sheets),
//               --root <project dir> (default: the folder above tools/), --browser <path> (or env CHROME_PATH).
// `worker` mode is used by tools/render.mjs (renders frame ranges on request over IPC).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- args ---------------------------------------------------------------------------------------------------
const BOOL = new Set(['debug', 'clean', 'help', 'quiet', 'keep-profile']);
const argv = process.argv.slice(2);
const mode = argv[0];
const pos = [];
const flags = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const v = argv[i + 1];
    if (BOOL.has(k) || v === undefined || (v.startsWith('--') && Number.isNaN(Number(v)))) flags[k] = true;
    else { flags[k] = v; i++; }
  } else pos.push(a);
}
const num = (k, d) => (flags[k] === undefined ? d : Number(flags[k]));

const ROOT = flags.root
  ? path.resolve(flags.root)
  : fs.existsSync(path.join(HERE, '..', 'index.html')) ? path.resolve(HERE, '..') : process.cwd();

// ---- project config (js/timeline.mjs is plain ESM shared by picture and sound) --------------------------------
async function loadConfig() {
  const f = path.join(ROOT, 'js', 'timeline.mjs');
  const m = fs.existsSync(f) ? await import(pathToFileURL(f).href) : {};
  return { W: m.W ?? 1920, H: m.H ?? 1080, FPS: m.FPS ?? 60, DURATION: m.DURATION ?? null, COVERS: m.COVERS ?? [], BEAT: m.BEAT ?? 0.5 };
}
const CFG = await loadConfig();
const { W, H } = CFG;
const FPS = num('fps', CFG.FPS);
// a time is seconds, or beats with a 'b' suffix ("12b" = beat 12 of js/timeline.mjs), as in the timeline's b()
const sec = (s) => (String(s).endsWith('b') ? Number(String(s).slice(0, -1)) * CFG.BEAT : Number(s));

// ---- environment ----------------------------------------------------------------------------------------------
function findBrowser() {
  // --browser, CHROME_PATH, or BROWSER when it names an existing file (elsewhere BROWSER is often "firefox" or a script)
  const isFile = (p) => { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } };
  if (flags.browser) return isFile(flags.browser) ? flags.browser : null;
  for (const p of [process.env.CHROME_PATH, process.env.BROWSER]) if (isFile(p)) return p;
  const c = [];
  if (process.platform === 'win32') {
    const bases = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const base of bases) {
      c.push(path.join(base, 'Google/Chrome/Application/chrome.exe'), path.join(base, 'Microsoft/Edge/Application/msedge.exe'),
        path.join(base, 'Chromium/Application/chrome.exe'), path.join(base, 'BraveSoftware/Brave-Browser/Application/brave.exe'));
    }
  } else if (process.platform === 'darwin') {
    for (const app of ['Google Chrome', 'Chromium', 'Microsoft Edge', 'Brave Browser', 'Google Chrome Canary']) {
      const exe = app === 'Brave Browser' ? 'Brave Browser' : app;
      c.push(`/Applications/${app}.app/Contents/MacOS/${exe}`);
    }
  } else {
    for (const n of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser']) {
      const r = spawnSync('which', [n], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) c.push(r.stdout.trim());
    }
  }
  return c.find((p) => fs.existsSync(p)) || null;
}

function doctor() {
  let ok = true;
  const line = (good, what, detail) => { console.log(`${good ? 'ok  ' : 'FAIL'}  ${what.padEnd(9)} ${detail}`); if (!good) ok = false; };
  const [maj, min] = process.versions.node.split('.').map(Number);
  line(maj > 22 || (maj === 22 && min >= 4), 'node', `${process.versions.node} (needs >= 22.4 for the global WebSocket)`);
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const r = spawnSync(tool, ['-hide_banner', '-version'], { encoding: 'utf8' });
    line(r.status === 0, tool, r.status === 0 ? r.stdout.split('\n')[0] : 'not found on PATH — install ffmpeg (it ships ffprobe)');
  }
  const b = findBrowser();
  line(!!b, 'browser', b || 'no Chrome / Edge / Chromium / Brave found — install one or pass --browser <path> (env CHROME_PATH)');
  console.log(`      project   ${ROOT}  (${W}x${H} @ ${FPS} fps${CFG.DURATION ? `, ${CFG.DURATION} s` : ''})`);
  if (!ok) process.exitCode = 1;
}

// ---- static server (random free port) ----------------------------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.avif': 'image/avif', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain',
};
function serve() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const p = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(p, (err, data) => {
      if (err) {
        if (!u.endsWith('favicon.ico')) console.error(`[server] 404 ${u}`);
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

// ---- browser over CDP --------------------------------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(label) {
  const exe = findBrowser();
  if (!exe) throw new Error('No Chromium-based browser found. Install Chrome, Edge or Chromium, or pass --browser <path> (env CHROME_PATH).');
  if (typeof WebSocket === 'undefined') throw new Error(`Node ${process.versions.node} has no global WebSocket: use Node >= 22.4.`);
  // One profile per process, inside the project (not the system temp drive). Background networking and component
  // updates are off, so a fresh profile stays small and nothing is downloaded.
  const prof = path.join(ROOT, '.cache', 'browser', label);
  fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3 });
  fs.mkdirSync(prof, { recursive: true });
  const args = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, `--window-size=${W},${H}`,
    '--hide-scrollbars', '--force-device-scale-factor=1', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication',
  ];
  if (process.platform === 'linux') args.push('--disable-dev-shm-usage', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []));
  args.push('about:blank');
  const proc = spawn(exe, args, { stdio: 'ignore' });
  let exited = null;
  proc.on('error', (e) => { exited = `error ${e.code || e.message}`; });
  proc.on('exit', (code) => { exited = code ?? 'signal'; });
  for (let i = 0; i < 400; i++) {
    try {
      const port = Number(fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      if (port) return { proc, port, prof };
    } catch { /* not yet */ }
    if (exited !== null) throw new Error(`browser exited (${exited}) before DevTools came up: ${exe}`);
    await sleep(50);
  }
  proc.kill();
  throw new Error('browser did not open its DevTools port within 20 s');
}

function connect(wsUrl, onEvent) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
      } else if (msg.method && onEvent) onEvent(msg);
    };
    ws.onerror = () => reject(new Error(`cannot connect to ${wsUrl}`));
    ws.onclose = () => { for (const { rej } of pending.values()) rej(new Error('DevTools connection closed')); pending.clear(); };
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        const mid = ++id;
        pending.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params }));
      }),
      close: () => ws.close(),
    });
  });
}

async function evaluate(c, expression) {
  const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

/** Opens index.html?query in a fresh headless browser and waits for window.__ready. */
async function openPage({ query = '', label = `${mode}-${process.pid}`, page = 'index.html' } = {}) {
  const srv = await serve();
  const { proc, port, prof } = await launch(label);
  const base = `http://127.0.0.1:${port}`;
  const ver = await (await fetch(`${base}/json/version`)).json();
  // /json/new cuts its URL at the first «&»: open a blank tab, then navigate.
  const tab = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
  const errors = [];
  const c = await connect(tab.webSocketDebuggerUrl, (msg) => {
    if (msg.method === 'Runtime.consoleAPICalled' && !flags.quiet) {
      console.log('[page]', msg.params.args.map((a) => a.value ?? a.description).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      const text = d.exception?.description || d.text;
      errors.push(text);
      console.error('[page error]', text);
    }
  });
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  await c.send('Page.bringToFront');
  await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  // Several headless browsers run side by side: each page must believe it has focus, or Chromium throttles it.
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const url = `http://127.0.0.1:${srv.address().port}/${page}${query ? `?${query}` : ''}`;
  await c.send('Page.navigate', { url });
  const t0 = Date.now();
  for (;;) {
    if (await evaluate(c, 'window.__ready === true').catch(() => false)) break;
    if (Date.now() - t0 > 60000) {
      throw new Error(`page never set window.__ready (60 s): ${url}${errors.length ? `\npage errors:\n  ${errors.join('\n  ')}` : ''}`);
    }
    await sleep(100);
  }
  const close = async () => {
    try {
      const b = await connect(ver.webSocketDebuggerUrl);
      await b.send('Browser.close').catch(() => {});
      b.close();
    } catch { /* already gone */ }
    c.close();
    srv.close();
    await Promise.race([new Promise((r) => proc.once('exit', r)), sleep(3000)]);
    try { proc.kill(); } catch { /* gone */ }
    if (!flags['keep-profile']) fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  return { c, close, errors };
}

async function frameAt(c, t, f, shot) {
  await evaluate(c, `window.__render(${t}, ${f})`);
  const { data } = await c.send('Page.captureScreenshot', shot);
  return Buffer.from(data, 'base64');
}

const queryOf = (extra = []) => [flags.query, ...extra].filter(Boolean).join('&');
const shotOpts = (scale) => (scale === 1
  ? { format: 'png', optimizeForSpeed: true }
  : { format: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, width: W, height: H, scale } });

// ---- modes ----------------------------------------------------------------------------------------------------------
async function still() {
  const out = flags.out ? path.resolve(flags.out) : path.join(ROOT, 'out/stills');
  fs.mkdirSync(out, { recursive: true });
  const { c, close } = await openPage({ query: queryOf(flags.debug ? ['debug=1'] : []) });
  try {
    for (const s of pos) {
      const t = sec(s);
      const buf = await frameAt(c, t, Math.floor(t * FPS + 1e-6), { format: 'png' });
      const file = path.join(out, `${flags.prefix || 't'}${t.toFixed(3).padStart(7, '0')}.png`);
      fs.writeFileSync(file, buf);
      console.log(file);
    }
  } finally { await close(); }
}

/** Frames at a list of times (frame numbers with an f suffix) tiled into one PNG, `cols` across. */
async function tiles(c, times, out, cols, scale) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  cols = Math.max(1, Math.min(cols, times.length));
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-i', '-',
    '-vf', `tile=${cols}x${Math.ceil(times.length / cols)}:padding=4:color=0x202020`, '-frames:v', '1', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r) => ff.on('close', r));
  try {
    for (const t of times) {
      const f = typeof t === 'string' ? Number(t.slice(0, -1)) : Math.floor(t * FPS + 1e-6);
      ff.stdin.write(await frameAt(c, typeof t === 'string' ? f / FPS : t, f, shotOpts(scale)));
    }
  } finally { ff.stdin.end(); }
  const code = await done;
  if (code !== 0) throw new Error(`ffmpeg exited ${code} while writing ${out}`);
  console.log(out);
}

async function sheet() {
  const [t0, t1] = pos.slice(0, 2).map(sec);
  const n = Number(pos[2]);
  if (!(n >= 1)) throw new Error('usage: sheet <t0> <t1> <count> [--cols 6] [--scale 0.25] [--out out/sheet.png]');
  const out = flags.out ? path.resolve(flags.out) : path.join(ROOT, 'out/sheet.png');
  const times = Array.from({ length: n }, (_, i) => (n === 1 ? t0 : t0 + (t1 - t0) * (i / (n - 1))));
  const { c, close } = await openPage({ query: queryOf(flags.clean ? [] : ['debug=1']) }); // time overlay unless --clean
  try { await tiles(c, times, out, num('cols', 6), num('scale', W > H ? 0.25 : 0.2)); } finally { await close(); }
}

/**
 * The critique set (SKILL.md step 7): one frame per beat (layout, variety, dead beats), the film at the width of a
 * phone held upright (can it be read?), and 12 consecutive frames through every fast move of WHIPS and across every
 * scene change (pops, overlaps, a flash, text that smears during a handoff) — the cuts are where a film breaks. Look
 * at all of them as a harsh motion director, not as their proud author.
 */
async function review() {
  const dir = flags.out ? path.resolve(flags.out) : path.join(ROOT, 'out/review');
  const TL = await import(pathToFileURL(path.join(ROOT, 'js', 'timeline.mjs')).href);
  const dur = CFG.DURATION ?? 15;
  const step = CFG.BEAT * Math.max(1, Math.ceil(dur / CFG.BEAT / 96)); // at most 96 tiles: every beat, or every 2nd
  const beats = [];
  for (let t = 0; t < dur - 0.5 / FPS; t += step) beats.push(t);
  const secs = [];
  for (let t = 0.5; t < dur; t += Math.max(1, dur / 32)) secs.push(t);
  const mids = (TL.WHIPS || []).map(([a, z]) => (a + z) / 2);
  for (const [a] of Object.values(TL.S || {})) if (a > 0.05 && !mids.some((m) => Math.abs(m - a) < 0.3)) mids.push(a);
  const cuts = mids.sort((x, y) => x - y).slice(0, 16);
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (/^strip-.*\.png$/.test(f)) fs.rmSync(path.join(dir, f));
  let { c, close } = await openPage({ query: queryOf(['debug=1']) });
  try {
    await tiles(c, beats, path.join(dir, 'beats.png'), 8, Math.min(0.25, 320 / W));
    for (const m of cuts) {
      const f0 = Math.max(0, Math.min(Math.floor(dur * FPS) - 12, Math.round(m * FPS) - 6));
      await tiles(c, Array.from({ length: 12 }, (_, k) => `${f0 + k}f`), path.join(dir, `strip-${m.toFixed(2)}s.png`), 12, 160 / W);
    }
  } finally { await close(); }
  ({ c, close } = await openPage({ query: queryOf([]) })); // the phone view without the time overlay
  try { await tiles(c, secs, path.join(dir, 'phone.png'), 4, 360 / W); } finally { await close(); }
  console.log(`\nLook at ${path.relative(ROOT, dir)}/beats.png, phone.png${cuts.length ? ' and strip-*.png (every fast move and scene change)' : ''} as a harsh motion director.`);
  console.log('Score 1–10: hook in the first 2 s · readable at phone size · motion (eases, springs, no dead frames) · variety (something new every 2–4 s)');
  console.log('· composition (one hero, the frame filled) · brand and data accuracy · sound sync (on the draft with sound). Write the scores and the');
  console.log('three worst problems with their times in REVIEW.md, fix those, run again — until every score is 8 or more.');
}

/**
 * Determinism: the same times rendered forward, backward and shuffled must leave the stage identical (its markup and
 * the pixels of its 2D canvases). A difference means a frame depends on something besides t — Math.random, Date.now,
 * a timer, state carried from the frame before — and the render's chunks and motion-blur samples will not agree.
 */
async function verify() {
  const TL = await import(pathToFileURL(path.join(ROOT, 'js', 'timeline.mjs')).href);
  const dur = CFG.DURATION ?? 15;
  const n = num('n', 12);
  const times = new Set(Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) / n) * dur * FPS) / FPS));
  for (const [a, z] of TL.WHIPS || []) times.add(Math.round(((a + z) / 2) * FPS) / FPS);
  const ts = [...times].sort((x, y) => x - y);
  // what is on screen: every visible element's attributes and text, and the pixels of 2D canvases (a hidden scene keeps
  // the styles of the last frame it drew — invisible, and not part of the frame)
  const fp = `(() => {
    const walk = (e) => { const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return '';
      let s = '<' + e.tagName + [...e.attributes].map((a) => a.name + '=' + a.value).join(' ');
      if (e.tagName === 'CANVAS') {
        const g = e.getContext('2d');
        let d = g ? g.getImageData(0, 0, e.width, e.height).data : null;
        const w = g ? null : e.getContext('webgl2') || e.getContext('webgl');
        if (w) { d = new Uint8Array(4 * e.width * e.height); w.bindFramebuffer(w.FRAMEBUFFER, null); w.readPixels(0, 0, e.width, e.height, w.RGBA, w.UNSIGNED_BYTE, d); }
        if (d) { let h = 0; for (let i = 0; i < d.length; i += 61) h = (h * 31 + d[i]) | 0; s += '#' + h; }
      }
      for (const n of e.childNodes) s += n.nodeType === 3 ? n.textContent : n.nodeType === 1 ? walk(n) : '';
      return s + '>'; };
    const s = walk(document.getElementById('stage'));
    let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); })()`;
  const { c, close } = await openPage({ query: queryOf([]) });
  const seen = new Map();
  const bad = new Set();
  try {
    const shuffled = [...ts].sort((x, y) => Math.sin(x * 12.9898) - Math.sin(y * 12.9898));
    for (const order of [ts, [...ts].reverse(), shuffled]) {
      for (const t of order) {
        await evaluate(c, `window.__render(${t}, ${Math.round(t * FPS)})`);
        const h = await evaluate(c, fp);
        if (seen.has(t) && seen.get(t) !== h) bad.add(t);
        seen.set(t, h);
      }
    }
  } finally { await close(); }
  if (bad.size) {
    console.log(`FAIL  ${[...bad].map((t) => `${t.toFixed(3)} s`).join(', ')} rendered differently in another order: something there is not a function of t (Math.random, Date.now, a timer, a value kept from the frame before) — SKILL.md, Traps`);
    process.exitCode = 1;
  } else console.log(`PASS  ${ts.length} times, rendered forward, backward and shuffled: the same frames every time`);
}

/** Largest divisor of `slots` that is <= want (so every output frame averages exactly `slots` images). */
function samplesFor(slots, want) {
  let n = Math.max(1, Math.min(slots, Math.round(want)));
  while (slots % n) n--;
  return n;
}

/**
 * Renders frames [f0, f1) into an intermediate H.264 file (yuv444p, CRF 8). Motion blur: each output frame is the
 * mean of `slots` images spread over a 180° shutter; frames whose first and last samples are identical (nothing
 * moves) are captured twice instead of `slots` times.
 */
async function renderRange(c, f0, f1, out, { slots = 16, scale = 1, shutter = 0.5, crf = 8, log = true } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // written beside its final name and moved there only when complete: a stopped render leaves no half-written chunk
  // for a later --range run to reuse
  const part = out.replace(/(\.\w+)?$/, '.partial$1');
  const vf = slots > 1 ? `tmix=frames=${slots},select='not(mod(n+1\\,${slots}))',setpts=N/(${FPS}*TB)` : 'null';
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * slots), '-c:v', 'png', '-i', '-',
    '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'fast', '-crf', String(crf), '-pix_fmt', 'yuv444p', part],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r) => ff.on('close', r));
  const write = (buf) => new Promise((r) => { if (ff.stdin.write(buf)) r(); else ff.stdin.once('drain', r); });
  const shot = shotOpts(scale);
  const started = Date.now();
  let captures = 0;
  try {
    for (let f = f0; f < f1; f++) {
      if (slots === 1) {
        await write(await frameAt(c, f / FPS, f, shot));
        captures++;
        continue;
      }
      const want = await evaluate(c, `window.__samples ? window.__samples(${f / FPS}) : ${slots}`);
      const n = samplesFor(slots, Math.max(2, want));
      const ts = Array.from({ length: n }, (_, k) => (f + ((k + 0.5) / n - 0.5) * shutter) / FPS);
      const first = await frameAt(c, ts[0], f, shot);
      const last = await frameAt(c, ts[n - 1], f, shot);
      captures += 2;
      if (first.equals(last)) {
        for (let k = 0; k < slots; k++) await write(first);
      } else {
        const bufs = [first];
        for (let k = 1; k < n - 1; k++) { bufs.push(await frameAt(c, ts[k], f, shot)); captures++; }
        bufs.push(last);
        const rep = slots / n;
        for (const buf of bufs) for (let r = 0; r < rep; r++) await write(buf);
      }
      if (log && (f - f0) % (FPS * 2) === 0 && f > f0) {
        console.log(`frame ${f}/${f1}  ${((Date.now() - started) / 1000).toFixed(0)} s  ${captures} captures`);
      }
    }
  } finally { ff.stdin.end(); }
  const code = await done;
  if (code !== 0) { fs.rmSync(part, { force: true }); throw new Error(`ffmpeg exited ${code} while writing ${out}`); }
  fs.renameSync(part, out);
  return { captures, secs: (Date.now() - started) / 1000 };
}

async function render() {
  const from = num('from', 0);
  const to = num('to', CFG.DURATION ?? 4);
  const out = flags.out ? path.resolve(flags.out) : path.join(ROOT, 'out/part.mp4');
  const { c, close } = await openPage({ query: queryOf() });
  try {
    const r = await renderRange(c, Math.round(from * FPS), Math.round(to * FPS), out,
      { slots: num('sub', 16), scale: num('scale', 1), shutter: num('shutter', 0.5), crf: num('crf', 8) });
    console.log(`done ${out}: ${r.captures} captures in ${r.secs.toFixed(0)} s`);
  } finally { await close(); }
}

async function evalMode() {
  const { c, close } = await openPage({ query: queryOf() });
  try {
    for (const s of String(flags.times || '0').split(',')) await evaluate(c, `window.__render(${sec(s)}, ${Math.floor(sec(s) * FPS)})`);
    console.log(JSON.stringify(await evaluate(c, pos[0]), null, 1));
  } finally { await close(); }
}

// IPC worker for tools/render.mjs: {job:{id, f0, f1, out}} → {done:{id, captures, secs}} | {failed:{id, error}}
async function worker() {
  const opts = { slots: num('sub', 16), scale: num('scale', 1), shutter: num('shutter', 0.5), crf: num('crf', 8), log: false };
  const { c, close } = await openPage({ query: queryOf(), label: `w${flags.slot ?? 0}-${process.pid}` });
  process.on('message', async (m) => {
    if (m.quit) { await close(); process.exit(0); }
    if (!m.job) return;
    try {
      const r = await renderRange(c, m.job.f0, m.job.f1, m.job.out, opts);
      process.send({ done: { id: m.job.id, ...r } });
    } catch (e) {
      process.send({ failed: { id: m.job.id, error: String(e.stack || e) } });
    }
  });
  process.on('disconnect', async () => { await close(); process.exit(0); });
  process.send({ ready: true });
}

const MODES = { doctor, still, sheet, review, verify, render, eval: evalMode, worker };
// run as a command (compared as real paths: a symlink or a junction in the path must not turn the CLI off)
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  if (!MODES[mode] || flags.help) {
    console.log('usage: node tools/capture.mjs doctor | still <t...> | sheet <t0> <t1> <n> | review | verify | render --from A --to B | eval "<expr>" [--times ...]');
    console.log('times are seconds (7.5) or beats of js/timeline.mjs with a b suffix (15b): still 15b 15.5b · sheet 0b 32b 24');
    process.exitCode = mode && !flags.help ? 1 : 0;
  } else {
    try { await MODES[mode](); } catch (e) { console.error(String(e.stack || e)); process.exitCode = 1; if (mode === 'worker') process.exit(1); }
  }
}
