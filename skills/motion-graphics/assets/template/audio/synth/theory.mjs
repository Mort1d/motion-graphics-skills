// Music theory and sequencing: scales, chord symbols, roman-numeral progressions, voice leading, a harmony table that
// drives every part at once, drum-grid patterns ('x...x...') and note strings ('C4 . Eb4 _ G4'). Times in seconds.
import { ctx, note, rand } from './core.mjs';

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11], phrygianDominant: [0, 1, 4, 5, 7, 8, 10], pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10], wholeTone: [0, 2, 4, 6, 8, 10], hirajoshi: [0, 2, 3, 7, 8],
  inSen: [0, 1, 5, 7, 10],
};

/**
 * A key: scale('A', 'minor') → { root, mode, deg(i, oct), notes(oct) }. deg(0) is the tonic; deg(7) the next octave;
 * negative degrees go down. oct = octave of the tonic (default 4).
 */
export function scale(root, mode = 'minor') {
  const steps = SCALES[mode];
  if (!steps) throw new Error(`unknown scale "${mode}" (${Object.keys(SCALES).join(', ')})`);
  const r = note(`${String(root).replace(/-?\d+$/, '')}4`) % 12;
  const deg = (i, oct = 4) => {
    const n = steps.length;
    const o = Math.floor(i / n);
    return 12 * (oct + 1) + r + steps[((i % n) + n) % n] + 12 * o;
  };
  return { root: r, mode, steps, deg, notes: (oct = 4) => steps.map((s) => 12 * (oct + 1) + r + s) };
}

const QUAL = {
  '': [0, 4, 7], maj: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], '+': [0, 4, 8], 5: [0, 7],
  sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mM7: [0, 3, 7, 11], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], 9: [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14],
  11: [0, 4, 7, 10, 14, 17], m11: [0, 3, 7, 10, 14, 17], 13: [0, 4, 7, 10, 14, 21], '6/9': [0, 4, 7, 9, 14],
};
/**
 * Chord symbol → MIDI notes from the root at `oct`: chord('Am7', 3) → [57, 60, 64, 67]; 'F#m9', 'Bbmaj7', 'Esus4',
 * 'C/E' (slash bass goes below). Returns an array with .root (the bass note, octave oct - 1).
 */
export function chord(sym, oct = 4) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(String(sym).trim());
  if (!m || !(m[2] in QUAL)) throw new Error(`bad chord "${sym}" (qualities: ${Object.keys(QUAL).filter(Boolean).join(' ')})`);
  const root = note(`${m[1]}${oct}`);
  const notes = QUAL[m[2]].map((i) => root + i);
  if (m[3]) {
    let b = note(`${m[3]}${oct}`);
    while (b >= notes[0]) b -= 12;
    notes.unshift(b);
  }
  notes.root = note(`${m[3] || m[1]}${oct - 1}`);
  return notes;
}

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
/**
 * Roman-numeral progression in a key: prog('i VI III VII', 'A', 'minor') → chords (arrays of MIDI, each with .root).
 * Upper case = major, lower = minor, '°' = diminished, a trailing '7' adds the seventh from the scale.
 */
export function prog(numerals, key, mode = 'major', { oct = 4, sevenths = false } = {}) {
  const sc = scale(key, mode);
  return numerals.trim().split(/\s+/).map((tok) => {
    const mm = /^(b?)([ivIV]+)(°|o)?(7)?$/.exec(tok);
    if (!mm) throw new Error(`bad numeral "${tok}"`);
    const idx = ROMAN.indexOf(mm[2].toLowerCase());
    const rootNote = sc.deg(idx, oct) - (mm[1] ? 1 : 0);
    const upper = mm[2] === mm[2].toUpperCase();
    const third = upper ? 4 : 3;
    const fifth = mm[3] ? 6 : 7;
    const out = [rootNote, rootNote + third, rootNote + fifth];
    if (mm[4] || sevenths) {
      const seventh = sc.deg(idx + 6, oct) - (mm[1] ? 1 : 0);
      out.push(seventh < rootNote + fifth ? seventh + 12 : seventh);
    }
    out.root = rootNote - 12;
    return out;
  });
}

/** Voice leading: moves each chord's notes by octaves to stay close to the previous chord (smooth pads / keys). */
export function voiceLead(chords, center = 62) {
  let prev = null;
  return chords.map((c) => {
    const ref = prev || c.map((x, i) => center - 5 + i * 4);
    const out = c.map((x) => {
      const target = ref.reduce((best, r) => (Math.abs(r - x) < Math.abs(best - x) ? r : best), ref[0]);
      let y = x;
      while (y - target > 6) y -= 12;
      while (target - y > 6) y += 12;
      return y;
    }).sort((a, z) => a - z);
    out.root = c.root;
    prev = out;
    return out;
  });
}

/**
 * Harmony table: one list of [beat, chordSymbol] drives bass, pads, stabs and arps together (the progression lives in
 * one place, so a key change or a new chord changes every part). harmony([[0,'Am7'],[8,'Fmaj7'],...], { oct: 4 }) →
 * { at(beat) → chord, spans(b0, b1) → [[fromBeat, toBeat, chord], ...] }.
 */
export function harmony(table, { oct = 4 } = {}) {
  const rows = [...table].sort((a, z) => a[0] - z[0]).map(([b, sym]) => [b, chord(sym, oct), sym]);
  const at = (beat) => { let c = rows[0]; for (const r of rows) if (r[0] <= beat + 1e-9) c = r; return c[1]; };
  const spans = (b0, b1) => rows.map((r, i) => [Math.max(r[0], b0), Math.min(i + 1 < rows.length ? rows[i + 1][0] : Infinity, b1), r[1], r[2]])
    .filter(([a, z]) => z > a);
  return { at, spans, rows };
}

/**
 * Drum-grid pattern → hits. pattern: 'X' accent (vel 1), 'x' normal (0.8), 'o' ghost (0.45), '.' or '-' rest; '|' and
 * spaces are ignored (use them to mark beats). The pattern loops from `from` to `to` (seconds). step: seconds per
 * character (default a 16th note). swing: 0..0.5 delays every second step. humanize: seconds of random timing.
 * Returns [{ t, vel, i, bar }].
 */
export function steps(pattern, { from = 0, to, step, swing = 0, humanize = 0, bars = null } = {}) {
  const p = pattern.replace(/[|\s]/g, '');
  const st = step ?? 60 / ctx.bpm / 4;
  const end = to ?? (bars ? from + bars * p.length * st : from + p.length * st);
  const out = [];
  for (let i = 0; ; i++) {
    const t0 = from + i * st;
    if (t0 >= end - 1e-9) break;
    const c = p[i % p.length];
    const vel = c === 'X' ? 1 : c === 'x' ? 0.8 : c === 'o' ? 0.45 : 0;
    if (!vel) continue;
    const t = t0 + (i % 2 === 1 ? swing * st : 0) + (humanize ? (rand() - 0.5) * 2 * humanize : 0);
    out.push({ t, vel, i, bar: Math.floor((i * st) / (4 * (60 / ctx.bpm))) });
  }
  return out;
}

/**
 * Note string → notes: 'C4 . Eb4 _ G4 . Bb4 .' — a token per step: a note name (or MIDI number), '.' rest, '_' holds
 * the previous note one more step; append '!' for an accent, '~' to slide into it. Returns [{ t, dur, note, vel, slide }].
 */
export function seq(str, { from = 0, step, loops = 1 } = {}) {
  const st = step ?? 60 / ctx.bpm / 4;
  const toks = str.trim().split(/\s+/).filter((x) => x !== '|');
  const out = [];
  for (let L = 0; L < loops; L++) {
    toks.forEach((tok, i) => {
      const t = from + (L * toks.length + i) * st;
      if (tok === '.') return;
      if (tok === '_') { if (out.length) out[out.length - 1].dur += st; return; }
      const slide = tok.includes('~');
      const acc = tok.includes('!');
      const nm = tok.replace(/[~!]/g, '');
      out.push({ t, dur: st, note: /^-?\d+$/.test(nm) ? Number(nm) : note(nm), vel: acc ? 1 : 0.8, slide, accent: acc });
    });
  }
  return out;
}
