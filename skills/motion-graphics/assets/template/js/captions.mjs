// Captions from the person's own subtitles — an SRT or VTT file (a phone's or an editor's export, a transcription the
// person made) or word timings as JSON [{ word, start, end }] — cut into short chunks for kinetic captions. Plain ESM,
// no DOM and no files: the scene fetches the text in build(), the score reads it with fs and ducks under the words.

const clock = (s) => {
  const m = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/.exec(s);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000 : NaN;
};

/** SRT or VTT text → cues [{ start, end, text }] in seconds (styling tags dropped). */
export function parseSubs(text) {
  const cues = [];
  for (const block of String(text).replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim());
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, z] = lines[i].split('-->');
    const t = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
    const start = clock(a);
    const end = clock(z);
    if (t && Number.isFinite(start) && end > start) cues.push({ start, end, text: t });
  }
  return cues;
}

/**
 * Words with times → [{ w, start, end }]. From SRT / VTT text each cue's time is shared by its words in proportion to
 * their length (a phrase-level file knows no more — word timings are better when the person has them); from an array
 * of word timings ({ word | text | w, start, end }) as they are.
 */
export function wordsOf(input) {
  if (Array.isArray(input)) return input.map((x) => ({ w: String(x.w ?? x.word ?? x.text ?? '').trim(), start: Number(x.start), end: Number(x.end) })).filter((x) => x.w && x.end > x.start);
  const out = [];
  for (const c of parseSubs(input)) {
    const ws = c.text.split(' ').filter(Boolean);
    const total = ws.reduce((s, w) => s + w.length + 1, 0);
    let at = c.start;
    for (const w of ws) {
      const d = ((w.length + 1) / total) * (c.end - c.start);
      out.push({ w, start: at, end: at + d });
      at += d;
    }
  }
  return out;
}

/**
 * Words → caption chunks of up to `max` words → [{ start, end, text, words }]. A chunk ends at punctuation or at a
 * pause of `gap` s, and grows by a word rather than flash for less than `minDur` s. Each chunk holds until the next one
 * begins (at most `hold` s past its last word), so no blank frame flickers between them. upper: the bold-overlay look.
 */
export function chunks(words, { max = 2, gap = 0.3, minDur = 0.35, hold = 0.4, upper = false } = {}) {
  const out = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur, text: cur.map((x) => (upper ? x.w.toUpperCase() : x.w)).join(' ') });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    cur.push(words[i]);
    const next = words[i + 1];
    const pause = next ? next.start - words[i].end : Infinity;
    const stop = /[.,!?;:…»"”)]$/.test(words[i].w);
    const long = words[i].end - cur[0].start >= minDur;
    if ((long && (cur.length >= max || stop || pause >= gap)) || cur.length > max) flush();
  }
  flush();
  for (let i = 0; i < out.length; i++) out[i].end = Math.min(i + 1 < out.length ? out[i + 1].start : Infinity, out[i].end + hold);
  return out;
}

/** Items (words or chunks) moved by d seconds: a clip's own time → the film's (d = the scene's start − the cut's from). */
export const shift = (items, d) => items.map((x) => ({ ...x, start: x.start + d, end: x.end + d, ...(x.words ? { words: shift(x.words, d) } : {}) }));

/** The item on screen at t, or null. */
export const at = (items, t) => items.find((x) => t >= x.start && t < x.end) ?? null;
