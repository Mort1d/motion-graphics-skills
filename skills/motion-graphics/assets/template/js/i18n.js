// The words of this cut: ?lang=xx selects COPY[xx] (default DEFAULT_LANG). Scenes import TX from here.
import { COPY, DEFAULT_LANG } from './copy.mjs';

export const LANG = new URLSearchParams(location.search).get('lang') || DEFAULT_LANG;
export const TX = COPY[LANG] || COPY[DEFAULT_LANG];
document.documentElement.lang = LANG;
document.documentElement.classList.add(`lang-${LANG}`);
