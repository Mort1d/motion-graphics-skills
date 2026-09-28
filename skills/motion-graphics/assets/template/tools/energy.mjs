// The energy plan, checked. js/timeline.mjs says how hard each scene should hit — ENERGY = { scene: 'low' | 'mid' |
// 'high' }, written from the person's words, then the references, then the topic (SKILL.md step 3) — and the mix is
// measured against it, scene by scene, at the 75th percentile so a short break inside a scene does not count:
//  · a scene of 3.3 s or more by its short-term loudness (3 s window) where that window lies inside the scene — steady,
//    and blind to the scene before it;
//  · a shorter scene by its momentary loudness (400 ms) — noisier, so it can only WARN.
// Used by audio-check.mjs and qa.mjs.
export const LEVELS = ['low', 'mid', 'high'];
const LONG = 3.3; // s: a scene this long has a full short-term window inside it
// LU under the loudest scene. Calibrated on nine finished promos, long scenes: their full-groove scenes sit 0–1.6 under,
// their planned breaks 3.1–11; the thinned verse of a promo asked to be "dynamic" sat 2.7–3.0 under (its short scenes
// 2.3–2.8 by momentary loudness, where finished promos stay within 1.8).
const HIGH_FAIL = 2.5;
const HIGH_WARN = 2;
const LOW_GAP = 1.5; // a 'low' scene this close to the loudest one sounds like a drop

/** The loudness curve (every 100 ms) from an ffmpeg ebur128 framelog: momentary M and short-term S. */
export function curveOf(log) {
  const num = (s) => (s === '-inf' ? -Infinity : Number(s));
  return [...String(log).matchAll(/t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)/g)]
    .map((m) => ({ t: Number(m[1]), M: num(m[2]), S: num(m[3]) }));
}

// -70 LUFS is BS.1770's absolute gate: below it is silence, or a window still filling at the start
const heard = (v) => Number.isFinite(v) && v > -70;
const p75 = (v) => { const s = [...v].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.75))] : NaN; };

/** Per scene window of S: level (see above), momentary p75, and the old mean / max of the short-term loudness. */
export function perScene(curve, S) {
  return Object.entries(S || {}).map(([name, [a, z]]) => {
    const long = z - a >= LONG;
    const inside = curve.filter((p) => p.t >= a + 3 && p.t <= z && heard(p.S)).map((p) => p.S);
    const moment = curve.filter((p) => p.t > a + 0.2 && p.t <= z && heard(p.M)).map((p) => p.M);
    const old = curve.filter((p) => p.t > a + 0.3 && p.t <= z && heard(p.S)).map((p) => p.S);
    const level = long && inside.length ? p75(inside) : p75(moment);
    return {
      name, a, z, long: long && inside.length > 0, level, m: p75(moment),
      mean: old.length ? old.reduce((s, x) => s + x, 0) / old.length : NaN, max: old.length ? Math.max(...old) : NaN,
    };
  });
}

/** Rows { level, what, detail } for the scenes measured by perScene and the plan (null → the old contrast rule). */
export function planVerdict(scenes, plan) {
  const rows = [];
  if (!plan) {
    const per = scenes.filter((q) => Number.isFinite(q.mean) && Number.isFinite(q.max));
    if (!per.length) return rows;
    const spread = (k) => Math.max(...per.map((q) => q[k])) - Math.min(...per.map((q) => q[k]));
    rows.push({ level: 'INFO', what: 'energy', detail: 'no ENERGY plan in js/timeline.mjs — write one from the brief (SKILL.md step 3) and this check follows it' });
    // without a plan, a short promo is expected to build and drop
    if (per.length >= 3 && spread('max') < 3 && spread('mean') < 3) rows.push({ level: 'WARN', what: 'dynamics', detail: 'every scene is about as loud as the others — no build, no drop: thin the verses, open the drops (or write an ENERGY plan that says so)' });
    else if (per.length >= 3) rows.push({ level: 'PASS', what: 'dynamics', detail: `scene means span ${spread('mean').toFixed(1)} LU, maxima ${spread('max').toFixed(1)} LU` });
    return rows;
  }
  const wrong = Object.entries(plan).filter(([, v]) => !LEVELS.includes(v));
  if (wrong.length) rows.push({ level: 'FAIL', what: 'energy', detail: `ENERGY ${wrong.map(([k, v]) => `${k}: '${v}'`).join(', ')} — each level is 'low', 'mid' or 'high'` });
  // a layer under the whole film (a background world, a grain) is not a scene of the story: only if the plan names it
  const whole = Math.max(...scenes.map((q) => q.z)) - Math.min(...scenes.map((q) => q.a));
  const story = scenes.filter((q) => plan[q.name] || q.z - q.a < 0.9 * whole);
  const unmeasured = story.filter((q) => plan[q.name] && !Number.isFinite(q.level)).map((q) => q.name);
  if (unmeasured.length) rows.push({ level: 'INFO', what: 'energy', detail: `not measured (too short or silent): ${unmeasured.join(', ')}` });
  const per = story.filter((q) => Number.isFinite(q.level));
  if (!per.length) return rows;
  const missing = per.filter((q) => !plan[q.name]).map((q) => q.name);
  if (missing.length) rows.push({ level: 'WARN', what: 'energy', detail: `no ENERGY for ${missing.join(', ')} — plan every scene of S` });
  // long scenes against the loudest long one; short scenes, by momentary loudness, against the loudest of all
  const loudLong = Math.max(...per.filter((q) => q.long).map((q) => q.level));
  const loudM = Math.max(...per.map((q) => q.m).filter(Number.isFinite));
  const hasHigh = per.some((q) => plan[q.name] === 'high');
  const under = [];
  const soft = [];
  const tooLoud = [];
  for (const q of per) {
    const down = q.long ? loudLong - q.level : loudM - q.m;
    const tag = q.long ? '' : ', a short scene';
    if (plan[q.name] === 'high' && q.long && down > HIGH_FAIL) under.push(`${q.name} (planned high, ${down.toFixed(1)} LU under the loudest scene)`);
    else if (plan[q.name] === 'high' && down > HIGH_WARN) soft.push(`${q.name} (planned high, ${down.toFixed(1)} LU under${tag})`);
    if (plan[q.name] === 'low' && hasHigh && down < LOW_GAP && per.some((p) => p !== q && plan[p.name] === 'high')) tooLoud.push(`${q.name} (planned low, ${down.toFixed(1)} LU under the loudest scene${tag})`);
  }
  if (under.length) rows.push({ level: 'FAIL', what: 'energy', detail: `${under.join('; ')} — bring the full groove in there (drums and bass); build contrast by adding layers, not by taking the drums out` });
  if (soft.length) rows.push({ level: 'WARN', what: 'energy', detail: `${soft.join('; ')} — is the full groove there? A little under the loudest scene is fine, a thinned groove is not` });
  if (tooLoud.length) rows.push({ level: 'WARN', what: 'energy', detail: `${tooLoud.join('; ')} — it sounds like a drop: thin it out or lower it, or plan it higher` });
  const levels = new Set(per.map((q) => plan[q.name]).filter(Boolean));
  const spread = Math.max(...per.map((q) => q.m)) - Math.min(...per.map((q) => q.m));
  if (levels.has('low') && levels.has('high') && per.length >= 3 && spread < 3) rows.push({ level: 'WARN', what: 'dynamics', detail: 'the plan mixes low and high scenes, but they sound about as loud — open the high ones, thin the low ones' });
  if (!rows.some((r) => r.level === 'FAIL' || r.level === 'WARN')) rows.push({ level: 'PASS', what: 'energy', detail: `the mix follows the plan (${per.map((q) => `${q.name} ${plan[q.name]}`).join(' · ')})` });
  return rows;
}
