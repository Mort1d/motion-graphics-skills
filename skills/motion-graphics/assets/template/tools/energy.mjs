// The energy plan, checked. js/timeline.mjs says how hard each scene should hit — ENERGY = { scene: 'low' | 'mid' |
// 'high' }, written from the person's words, then the references, then the topic (SKILL.md step 3) — and the mix is
// measured against it: the short-term loudness (ffmpeg ebur128, 3 s window) of each scene window, at its 75th
// percentile, so a short break inside a scene does not count against the scene. Used by audio-check.mjs and qa.mjs.
export const LEVELS = ['low', 'mid', 'high'];
// LU under the loudest scene. Calibrated on nine finished promos: their full-groove scenes sit 0–1.8 under (once
// 2.1), their planned breaks 3–5; the thinned verse of a promo asked to be "dynamic" sat 2.4–3.0 under.
const HIGH_FAIL = 2.5;
const HIGH_WARN = 2;
const LOW_GAP = 1.5; // LU: a 'low' scene this close to the loudest one sounds like a drop

/** The short-term loudness curve (every 100 ms) from an ffmpeg ebur128 framelog. */
export function curveOf(log) {
  const num = (s) => (s === '-inf' ? -Infinity : Number(s));
  return [...String(log).matchAll(/t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)/g)]
    .map((m) => ({ t: Number(m[1]), M: num(m[2]), S: num(m[3]) }));
}

/** Per scene window of S: the 75th percentile, the mean and the maximum of the short-term loudness (LUFS). */
export function perScene(curve, S) {
  return Object.entries(S || {}).map(([name, [a, z]]) => {
    // -70 LUFS is BS.1770's absolute gate: below it is silence, or the 3 s window still filling at the start
    const v = curve.filter((p) => p.t > a + 0.3 && p.t <= z && Number.isFinite(p.S) && p.S > -70).map((p) => p.S).sort((x, y) => x - y);
    if (!v.length) return null;
    return { name, a, z, p75: v[Math.min(v.length - 1, Math.floor(v.length * 0.75))], mean: v.reduce((s, x) => s + x, 0) / v.length, max: v[v.length - 1] };
  }).filter(Boolean);
}

/** Rows { level, what, detail } for the scenes measured by perScene and the plan (null → the old contrast rule). */
export function planVerdict(per, plan) {
  const rows = [];
  if (!per.length) return rows;
  const spread = (k) => Math.max(...per.map((q) => q[k])) - Math.min(...per.map((q) => q[k]));
  if (!plan) {
    rows.push({ level: 'INFO', what: 'energy', detail: 'no ENERGY plan in js/timeline.mjs — write one from the brief (SKILL.md step 3) and this check follows it' });
    // without a plan, a short promo is expected to build and drop
    if (per.length >= 3 && spread('max') < 3 && spread('mean') < 3) rows.push({ level: 'WARN', what: 'dynamics', detail: 'every scene is about as loud as the others — no build, no drop: thin the verses, open the drops (or write an ENERGY plan that says so)' });
    else if (per.length >= 3) rows.push({ level: 'PASS', what: 'dynamics', detail: `scene means span ${spread('mean').toFixed(1)} LU, maxima ${spread('max').toFixed(1)} LU` });
    return rows;
  }
  const wrong = Object.entries(plan).filter(([, v]) => !LEVELS.includes(v));
  if (wrong.length) rows.push({ level: 'FAIL', what: 'energy', detail: `ENERGY ${wrong.map(([k, v]) => `${k}: '${v}'`).join(', ')} — each level is 'low', 'mid' or 'high'` });
  // a layer under the whole film (a background world, a grain) is not a scene of the story: only if the plan names it
  const whole = Math.max(...per.map((q) => q.z)) - Math.min(...per.map((q) => q.a));
  per = per.filter((q) => plan[q.name] || q.z - q.a < 0.9 * whole);
  if (!per.length) return rows;
  const missing = per.filter((q) => !plan[q.name]).map((q) => q.name);
  if (missing.length) rows.push({ level: 'WARN', what: 'energy', detail: `no ENERGY for ${missing.join(', ')} — plan every scene of S` });
  const loudest = Math.max(...per.map((q) => q.p75));
  const hasHigh = per.some((q) => plan[q.name] === 'high');
  const under = [];
  const soft = [];
  const tooLoud = [];
  for (const q of per) {
    const down = loudest - q.p75;
    if (plan[q.name] === 'high' && down > HIGH_FAIL) under.push(`${q.name} (planned high, ${down.toFixed(1)} LU under the loudest scene)`);
    else if (plan[q.name] === 'high' && down > HIGH_WARN) soft.push(`${q.name} (planned high, ${down.toFixed(1)} LU under)`);
    if (plan[q.name] === 'low' && hasHigh && down < LOW_GAP && per.some((p) => p !== q && plan[p.name] === 'high')) tooLoud.push(`${q.name} (planned low, ${down.toFixed(1)} LU under the loudest scene)`);
  }
  if (under.length) rows.push({ level: 'FAIL', what: 'energy', detail: `${under.join('; ')} — bring the full groove in there (drums and bass); build contrast by adding layers, not by taking the drums out` });
  if (soft.length) rows.push({ level: 'WARN', what: 'energy', detail: `${soft.join('; ')} — is the full groove there? A little under the loudest scene is fine, a thinned groove is not` });
  if (tooLoud.length) rows.push({ level: 'WARN', what: 'energy', detail: `${tooLoud.join('; ')} — it sounds like a drop: thin it out or lower it, or plan it higher` });
  const levels = new Set(per.map((q) => plan[q.name]).filter(Boolean));
  if (levels.has('low') && levels.has('high') && per.length >= 3 && spread('mean') < 3) rows.push({ level: 'WARN', what: 'dynamics', detail: 'the plan mixes low and high scenes, but they sound about as loud — open the high ones, thin the low ones' });
  if (!rows.some((r) => r.level === 'FAIL' || r.level === 'WARN')) rows.push({ level: 'PASS', what: 'energy', detail: `the mix follows the plan (${per.map((q) => `${q.name} ${plan[q.name]}`).join(' · ')}), scene levels span ${spread('p75').toFixed(1)} LU` });
  return rows;
}
