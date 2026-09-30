// Words that came from somewhere else: shared by js/main.js (the built scenes) and tools/plan-check.mjs (the copy).
// Plain ESM, no DOM.

// the letters of each writing system a language code resolves to; Latin passes in every language (brand names,
// addresses, codes)
const SCRIPTS = {
  Latn: ['Latin'], Cyrl: ['Cyrillic'], Grek: ['Greek'], Arab: ['Arabic'], Hebr: ['Hebrew'], Deva: ['Devanagari'],
  Thai: ['Thai'], Geor: ['Georgian'], Armn: ['Armenian'], Jpan: ['Han', 'Hiragana', 'Katakana'], Kore: ['Hangul', 'Han'],
  Hans: ['Han'], Hant: ['Han'],
};

/** A test for the letters a video in `lang` may show, or null when the language's script is not known here. */
export function lettersOf(lang) {
  let script;
  try { script = new Intl.Locale(String(lang)).maximize().script; } catch { return null; }
  const names = SCRIPTS[script];
  return names ? new RegExp(`[${['Latin', ...names].map((n) => `\\p{Script=${n}}`).join('')}]`, 'u') : null;
}

/** The letters of `text` in another script than `lang` is written in ('' when there are none). */
export function foreignLetters(text, lang) {
  const ok = lettersOf(lang);
  return ok ? [...String(text)].filter((ch) => /\p{L}/u.test(ch) && !ok.test(ch)).join('') : '';
}

// the template demo's own lines and contacts: in any other video they are left over
export const DEMO_WORDS = ['nova.example', '@nova_example', '(555) 010-0199', 'Your brand, in motion', 'PROMO VIDEOS FROM CODE',
  'Motion graphics, rendered from code', 'EVERY FRAME.', 'EVERY BEAT.'];

/** The demo's words found in `text`. */
export const demoLeft = (text) => DEMO_WORDS.filter((w) => String(text).toLowerCase().includes(w.toLowerCase()));

/** Every string inside a copy object (nested arrays and objects), for the checks above. */
export const stringsOf = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(stringsOf) : v && typeof v === 'object' ? Object.values(v).flatMap(stringsOf) : []);
