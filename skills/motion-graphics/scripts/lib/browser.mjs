// A headless Chrome / Edge / Chromium / Brave driven over the DevTools protocol through a pipe (as Playwright does),
// without npm packages. The pipe matters: when this Node process dies for any reason, the pipe closes and the browser
// exits with it — no orphaned browsers. Every call has a timeout. Each launch gets a fresh profile (no cookies or
// logins of the user's own browser), deleted on close; only the process this module started is ever stopped.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isFile = (p) => { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } };

/** CHROME_PATH (or BROWSER when it names an existing file), else the usual install places. */
export function findBrowser() {
  for (const p of [process.env.CHROME_PATH, process.env.BROWSER]) if (isFile(p)) return p;
  const c = [];
  if (process.platform === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      c.push(path.join(base, 'Google/Chrome/Application/chrome.exe'), path.join(base, 'Microsoft/Edge/Application/msedge.exe'),
        path.join(base, 'Chromium/Application/chrome.exe'), path.join(base, 'BraveSoftware/Brave-Browser/Application/brave.exe'));
    }
  } else if (process.platform === 'darwin') {
    for (const app of ['Google Chrome', 'Chromium', 'Microsoft Edge', 'Brave Browser']) c.push(`/Applications/${app}.app/Contents/MacOS/${app}`);
  } else {
    for (const n of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser']) {
      const r = spawnSync('which', [n], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) c.push(r.stdout.trim());
    }
  }
  return c.find(isFile) || null;
}

/**
 * Starts the browser. Resolves to { exe, send(method, params, opts), open(onEvent), close(), kill() }.
 * `profileDir` (default: the system temp folder) holds the throwaway profile.
 */
export async function launch({ width = 1440, height = 900, profileDir = os.tmpdir() } = {}) {
  const exe = findBrowser();
  if (!exe) throw new Error('No Chromium-based browser found. Install Chrome, Edge or Chromium, or set CHROME_PATH=<path to the executable>.');
  fs.mkdirSync(profileDir, { recursive: true });
  // a profile left by a run that was killed outright (no handler runs then): gone after an hour
  for (const d of fs.readdirSync(profileDir)) {
    const p = path.join(profileDir, d);
    try { if (/^browser-/.test(d) && Date.now() - fs.statSync(p).mtimeMs > 3600e3) fs.rmSync(p, { recursive: true, force: true }); } catch { /* in use */ }
  }
  const prof = fs.mkdtempSync(path.join(profileDir, 'browser-'));
  const args = [
    '--headless=new', '--remote-debugging-pipe', `--user-data-dir=${prof}`, `--window-size=${width},${height}`,
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--disable-background-networking', '--disable-component-update',
    '--disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication',
  ];
  if (process.platform === 'linux') args.push('--disable-dev-shm-usage', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []));
  args.push('about:blank');

  // fd 3: the browser reads commands; fd 4: it writes replies and events; messages end with a NUL byte
  const proc = spawn(exe, args, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr = (stderr + d.toString()).slice(-3000); });
  let exited = null;
  const removeProfile = () => { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); return true; } catch { return false; } };
  const kill = () => { try { proc.kill(); } catch { /* gone */ } };
  const onExit = () => { kill(); removeProfile(); };
  process.once('exit', onExit); // last resort: the process is ending, stop our browser and try to tidy
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'].filter((s) => process.platform !== 'win32' || s !== 'SIGHUP');
  const onSignal = (s) => { onExit(); process.exit(s === 'SIGINT' ? 130 : 143); };
  for (const s of signals) process.once(s, onSignal);

  let id = 0;
  const pending = new Map();
  const listeners = new Map(); // sessionId ('' = browser) → onEvent
  const fail = (err) => { for (const { rej, timer } of pending.values()) { clearTimeout(timer); rej(err); } pending.clear(); };
  proc.on('error', (e) => { exited = `error ${e.code || e.message}`; fail(new Error(`browser failed to start: ${e.message}`)); });
  proc.on('exit', (code) => { exited = code ?? 'signal'; fail(new Error(`the browser exited (${exited})${stderr ? `: ${stderr.trim().split('\n').slice(-3).join(' | ')}` : ''}`)); });
  let buf = Buffer.alloc(0);
  proc.stdio[4].on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (let i = buf.indexOf(0); i >= 0; i = buf.indexOf(0)) {
      const raw = buf.subarray(0, i).toString('utf8');
      buf = buf.subarray(i + 1);
      let msg;
      try { msg = JSON.parse(raw); } catch { continue; }
      if (msg.id && pending.has(msg.id)) {
        const { res, rej, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
      } else if (msg.method) listeners.get(msg.sessionId || '')?.(msg);
    }
  });
  proc.stdio[3].on('error', () => { /* the browser is gone; pending calls fail through 'exit' */ });

  const send = (method, params = {}, { sessionId, timeout = 30000 } = {}) => new Promise((res, rej) => {
    if (exited !== null) { rej(new Error(`the browser is not running (${exited})`)); return; }
    const mid = ++id;
    const timer = setTimeout(() => { pending.delete(mid); rej(new Error(`${method} timed out after ${timeout / 1000} s`)); }, timeout);
    pending.set(mid, { res, rej, timer });
    proc.stdio[3].write(`${JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
  });

  try {
    await send('Browser.getVersion', {}, { timeout: 20000 });
  } catch (e) {
    kill();
    removeProfile();
    throw new Error(`${exe} did not answer over DevTools: ${e.message}${stderr ? `\n${stderr.trim().split('\n').slice(-5).join('\n')}` : ''}`);
  }

  return {
    exe,
    send,
    /** A new tab. Its `send` and `evaluate` talk to that page; `evaluate(expr, { isolated: true })` runs in a world of
     * its own, where the page's scripts cannot change the built-ins it uses. */
    async open(onEvent) {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      if (onEvent) listeners.set(sessionId, onEvent);
      const page = { targetId, sessionId };
      page.send = (method, params = {}, opts = {}) => send(method, params, { ...opts, sessionId });
      page.evaluate = async (expression, { isolated = false, timeout = 30000 } = {}) => {
        const p = { expression, awaitPromise: true, returnByValue: true };
        if (isolated) {
          const { frameTree } = await page.send('Page.getFrameTree');
          const { executionContextId } = await page.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'site-kit' });
          p.contextId = executionContextId;
        }
        const r = await page.send('Runtime.evaluate', p, { timeout });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      };
      return page;
    },
    /** Closes the browser and deletes the profile; never throws. Returns a note when the profile stayed behind. */
    async close() {
      process.removeListener('exit', onExit);
      for (const s of signals) process.removeListener(s, onSignal);
      if (exited === null) {
        await send('Browser.close', {}, { timeout: 5000 }).catch(() => {});
        await Promise.race([new Promise((r) => (exited !== null ? r() : proc.once('exit', r))), sleep(5000)]);
      }
      kill();
      return removeProfile() ? null : `the browser profile ${prof} could not be deleted (still in use): remove it later`;
    },
    kill: onExit,
  };
}
