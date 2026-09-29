#!/usr/bin/env node
// The plan, checked before a single scene is built: js/timeline.mjs (scene windows, cues, the energy plan, LOOP),
// the Energy line of README.md and the copy. Seconds to run; a problem found here costs a line, found in a render it
// costs a render.
//   node tools/plan-check.mjs            exit code 1 when something FAILs; read every WARN
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// the person's words about how the video should feel, in the languages the skill is used in most
const DYNAMIC = /\b(dynamic|energetic|high[- ]energy|drive|driving|hype|punchy|powerful|intense|aggressive|hard-hitting|fast-paced|rock[- ]?n[- ]?roll|banger)\b|динамич|драйв|мощн|бодр|энергичн|жёстк|жестк|быстр|качов|кача[ею]т|рок-н-ролл/iu;
const CALM = /\b(calm|soft|gentle|cozy|cosy|relaxed|slow|serene|quiet|premium|luxur\w*)\b|спокойн|нежн|мягк|уютн|премиальн|медленн|плавн|тих/iu;
const LEVELS = new Set(['low', 'mid', 'high']);
// the same patterns as js/main.js: a scene counter or a chapter label is never on screen
const COUNTER = /^(?:(?:scene|chapter|part|step|shot|ch\.?|сцена|глава|часть|шаг|кадр)\s*)?(\d{1,2})\s*(?:\/|\||⁄|∕|of|из|—|–)\s*(\d{1,2})$/iu;
const LABEL = /^(?:scene|chapter|part|shot|сцена|глава|часть|кадр)\s*№?\s*\d{1,2}$/iu;

/** The Energy line of the README's direction or sound brief (not the "Energy map"), or null when it is not filled. */
export function energyLine(readme) {
  for (const m of String(readme).matchAll(/^[ \t]*[-*]?[ \t]*energy(?![ \t]*map)\b[^:\n]*:[ \t]*(.*)$/gim)) if (m[1].trim()) return m[1].trim();
  return null;
}

/**
 * What the words ask for: 'dynamic', 'calm', 'mixed' (both: "calm, then a blast") or null. When the line quotes the
 * person («…», "…", “…”), only the quotes count — the reasoning around them ("no reason for calm") is not a request.
 */
export function asked(line) {
  if (!line) return null;
  const quotes = [...String(line).matchAll(/«([^»]+)»|“([^”]+)”|"([^"]+)"/g)].map((m) => m[1] ?? m[2] ?? m[3]).join(' ');
  const words = quotes || line;
  const d = DYNAMIC.test(words);
  const c = CALM.test(words);
  return d && c ? 'mixed' : d ? 'dynamic' : c ? 'calm' : null;
}

/** Every check on a plan → [{ level, what, detail }]. TL: the timeline module; readme and copy: file texts. */
export function checkPlan(TL, { readme = '', copy = '', timelineSrc = '' } = {}) {
  const rows = [];
  const add = (level, what, detail) => rows.push({ level, what, detail });
  const S = TL.S || {};
  const CUE = TL.CUE || {};
  const BAR = TL.BAR || 4 * (TL.BEAT || 0.5);
  const DUR = TL.DURATION;
  const names = Object.keys(S);
  const fmt = (x) => `${x.toFixed(2)} s`;

  if (/@template-demo/.test(timelineSrc) && /MAKE/.test(copy)) add('WARN', 'template', 'js/timeline.mjs and js/copy.mjs are still the demo\'s: plan this video first');

  // the energy plan covers every scene (a layer that spans the whole film is not a scene)
  const layer = (n) => S[n][1] - S[n][0] >= 0.9 * DUR;
  const scenes = names.filter((n) => !layer(n));
  const E = TL.ENERGY;
  if (!E) add('WARN', 'energy', 'no ENERGY in js/timeline.mjs: write how hard each scene hits (SKILL.md step 3)');
  else {
    const bad = Object.entries(E).filter(([, v]) => !LEVELS.has(v));
    if (bad.length) add('FAIL', 'energy', `unknown levels: ${bad.map(([k, v]) => `${k}: '${v}'`).join(', ')} — use 'low', 'mid' or 'high'`);
    const missing = scenes.filter((n) => !(n in E));
    if (missing.length) add('WARN', 'energy', `no level for ${missing.join(', ')}`);
  }

  // the person's words against the plan: the release promo that asked for «прям динамичную» and got its groove at 20 s
  const line = energyLine(readme);
  const want = asked(line);
  if (!line) add('WARN', 'asked', 'README.md has no Energy line: write what the person asked for, or why the plan has this shape');
  else if (E && want === 'dynamic') {
    // the groove comes in within the first bar (a pickup); a low scene past 2 bars breaks the promise, 1–2 bars is a
    // long wait worth a second look
    const quiet = scenes.filter((n) => E[n] === 'low' && (S[n][0] > 2 * BAR + 0.01 || S[n][1] - S[n][0] > 2 * BAR + 0.5));
    const slow = scenes.filter((n) => E[n] === 'low' && !quiet.includes(n) && S[n][1] > BAR + 0.5);
    if (quiet.length) add('FAIL', 'asked', `the words ask for energy («${line}»), but ${quiet.map((n) => `${n} (${fmt(S[n][0])}–${fmt(S[n][1])})`).join(', ')} is planned 'low': keep the groove under every scene after the first bar`);
    else if (slow.length) add('WARN', 'asked', `the words ask for energy («${line}»), and ${slow.map((n) => `${n} stays 'low' until ${fmt(S[n][1])}`).join(', ')}: a pickup of a bar at most, then the groove (sound-design.md §5)`);
    else add('PASS', 'asked', `energy asked for, and the plan keeps it (${scenes.map((n) => `${n} ${E[n]}`).join(' · ')})`);
  } else if (E && want === 'calm') {
    const loud = scenes.filter((n) => E[n] === 'high');
    add(loud.length ? 'WARN' : 'PASS', 'asked', loud.length ? `the words ask for calm («${line}»), but ${loud.join(', ')} is planned 'high' — right only if they asked for a lift there` : 'calm asked for, and the plan stays calm');
  } else add('INFO', 'asked', `«${line}» — ${want === 'mixed' ? 'a shape with both calm and drive: check the plan follows its order' : 'no energy words: the plan comes from the topic and the references'}`);

  // the hook moves in the first second, and something new happens every few seconds
  const times = [...Object.values(CUE), ...names.map((n) => S[n][0]), ...(TL.WHIPS || []).map((w) => w[0])].filter((x) => Number.isFinite(x) && x >= 0 && x <= DUR).sort((a, b) => a - b);
  const cues = Object.values(CUE).filter(Number.isFinite).sort((a, b) => a - b);
  if (!cues.length) add('FAIL', 'cues', 'no CUE in js/timeline.mjs: name every slam, reveal and drop, so picture and sound share them');
  else {
    add(cues[0] <= 1 ? 'PASS' : 'WARN', 'hook', cues[0] <= 1 ? `first event at ${fmt(cues[0])}` : `nothing planned before ${fmt(cues[0])}: the hook moves and says its words in the first second`);
    const last = cues[cues.length - 1];
    const gaps = [];
    for (let i = 1; i < times.length; i++) if (times[i] <= last + 1e-6 && times[i] - times[i - 1] > 4) gaps.push([times[i - 1], times[i]]);
    add(gaps.length ? 'WARN' : 'PASS', 'pace', gaps.length ? `${gaps.map(([a, z]) => `${fmt(a)}–${fmt(z)}`).join(', ')} without a planned event: something new every 2–4 s (a hit, a reveal, a move — a CUE)` : 'an event at least every 4 s');
    // the end card stays long enough to be read, and the last hit has room to ring out
    const endScene = names.filter((n) => !layer(n)).sort((a, b) => S[b][1] - S[a][1])[0];
    const card = endScene ? Math.min(DUR, S[endScene][1]) - S[endScene][0] : 0;
    const after = (endScene ? Math.min(DUR, S[endScene][1]) : DUR) - last;
    const short = [];
    if (endScene && card < 2.5) short.push(`the end card ${endScene} is on screen only ${fmt(card)}: hold it ≥ 2.5 s with the logo and the CTA`);
    if (after < 1.5) short.push(`only ${fmt(after)} after the last cue: leave ≥ 1.5 s for the eye to rest and the sound to ring out`);
    add(short.length ? 'WARN' : 'PASS', 'end', short.length ? short.join('; ') : `the end card${endScene ? ` ${endScene}` : ''} is on screen ${fmt(card)}, ${fmt(after)} after the last cue`);
  }

  // scene windows: none empty or inverted, neighbours meet (a gap flashes the background)
  const order = names.filter((n) => !layer(n)).sort((a, b) => S[a][0] - S[b][0]);
  for (const n of order) if (!(S[n][1] > S[n][0])) add('FAIL', 'scenes', `${n}: its window [${S[n]}] is empty`);
  const holes = [];
  for (let i = 1; i < order.length; i++) if (S[order[i]][0] > S[order[i - 1]][1] + 1e-6) holes.push(`${order[i - 1]} ends ${fmt(S[order[i - 1]][1])}, ${order[i]} starts ${fmt(S[order[i]][0])}`);
  if (holes.length) add('WARN', 'scenes', `${holes.join('; ')} — neighbours overlap across a transition, or the background flashes`);
  if (order.length && S[order[0]][0] > 0.05) add('WARN', 'scenes', `the first scene starts at ${fmt(S[order[0]][0])}: frame 0 is empty`);

  // the video never numbers itself
  const strings = [...String(copy).matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2].trim());
  const counters = strings.filter((s) => { const m = COUNTER.exec(s); return (m && Number(m[1]) <= Number(m[2]) && Number(m[2]) <= 24) || LABEL.test(s); });
  if (counters.length) add('FAIL', 'counters', `${counters.map((s) => `"${s}"`).join(', ')} in js/copy.mjs — a scene counter reads as a template`);

  if (TL.LOOP) add('INFO', 'loop', 'LOOP: the last frame folds back into the first (the cursor, the colours, everything) — QA checks the seam');
  if (DUR > 90) add('INFO', 'length', `${DUR.toFixed(0)} s: a long film — plan it in chapters (references/pipeline.md)`);
  else if (DUR > 60) add('WARN', 'length', `${DUR.toFixed(0)} s: longer than most promos hold — right when the person asked for this length; otherwise cut to what the facts need, or plan chapters`);
  return rows;
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = (f) => (fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '');
  const TL = await import(pathToFileURL(path.join(ROOT, 'js/timeline.mjs')).href);
  const rows = checkPlan(TL, { readme: read('README.md'), copy: read('js/copy.mjs'), timelineSrc: read('js/timeline.mjs') });
  console.log('plan check (js/timeline.mjs, README.md, js/copy.mjs)');
  for (const r of rows) console.log(`${r.level.padEnd(5)} ${r.what.padEnd(9)} ${r.detail}`);
  const fails = rows.filter((r) => r.level === 'FAIL').length;
  const warns = rows.filter((r) => r.level === 'WARN').length;
  console.log(fails ? `${fails} FAIL, ${warns} WARN — fix the plan before building scenes` : `no failures${warns ? `, ${warns} WARN to read` : ''}`);
  if (fails) process.exitCode = 1;
}
