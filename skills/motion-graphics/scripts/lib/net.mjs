// Public media behind a link, for studying references: X / Twitter posts (X's own embed endpoint, then the public
// FxEmbed API as a fallback), Telegram channel posts (the t.me embed page), direct media URLs, and whatever yt-dlp
// supports when it is already installed (YouTube, Instagram, TikTok, Vimeo…). Public content only: no login, no
// cookies, nothing installed. Downloads of addresses found in pages refuse local and private networks. Node >= 22.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import dns from 'node:dns';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

/** Why a fetch failed, with the network cause that undici hides behind "fetch failed". */
export const why = (e) => [e?.message, e?.cause?.code, e?.cause?.message].filter(Boolean)
  .filter((x, i, a) => a.indexOf(x) === i).join(': ');

export async function get(url, { timeout = 20000, accept, referer, ua = UA } = {}) {
  const headers = { 'User-Agent': ua };
  if (accept) headers.Accept = accept;
  if (referer) headers.Referer = referer;
  return fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
}
export async function getJson(url, o = {}) {
  const r = await get(url, { ...o, accept: 'application/json' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  try { return JSON.parse(text); } catch { throw new Error(`not JSON (HTTP ${r.status})`); }
}
export async function getText(url, o = {}) {
  const r = await get(url, o);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

// ---- local and private addresses ------------------------------------------------------------------------------------
export function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateIp(mapped[1]);
  return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
}
/** Throws when the URL is not http(s) or its host resolves to a local or private address. */
export async function assertPublic(u) {
  const url = new URL(u);
  if (!/^https?:$/.test(url.protocol)) throw new Error(`refused: ${url.protocol} is not http(s)`);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [host] : (await dns.promises.lookup(host, { all: true })).map((a) => a.address);
  if (!addrs.length || addrs.some(privateIp)) throw new Error(`refused: ${host} is a local or private address`);
}
export async function isPrivateUrl(u) {
  try { await assertPublic(u); return false; } catch (e) { return /local or private/.test(e.message); }
}

/** The real type of a downloaded file from its first bytes (URLs lie: an og:image may answer with a web page). */
export function sniff(file) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(2048);
  const n = fs.readSync(fd, b, 0, 2048, 0);
  fs.closeSync(fd);
  const s = b.subarray(0, 32).toString('latin1');
  if (s.startsWith('\x89PNG')) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  if (s.startsWith('GIF8')) return 'gif';
  if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'webp';
  if (/^....ftypavi[fs]/.test(s)) return 'avif';
  if (/^....ftypqt/.test(s)) return 'mov';
  if (/^....ftyp/.test(s)) return 'mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico';
  if (!b.subarray(0, n).includes(0)) {
    const t = b.subarray(0, n).toString('utf8').trimStart().toLowerCase();
    if (/^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/.test(t)) return 'svg';
  }
  return null;
}

/**
 * Streams a URL (or a data: URL) into a file, refusing more than maxMb and — unless allowPrivate — any hop that lands
 * on a local or private address. Network errors, 5xx and 429 are retried; a download that stalls for idleMs is cut.
 */
export async function download(url, file, { maxMb = 300, idleMs = 60000, referer, tries = 3, allowPrivate = false } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (url.startsWith('data:')) {
    const m = url.match(/^data:[^,]*?(;base64)?,(.*)$/s);
    if (!m) throw new Error('bad data: URL');
    let buf;
    try { buf = m[1] ? Buffer.from(m[2], 'base64') : Buffer.from(decodeURIComponent(m[2])); } catch { throw new Error('bad data: URL'); }
    if (buf.length > maxMb * 1e6) throw new Error(`over the ${maxMb} MB limit`);
    fs.writeFileSync(file, buf);
    return buf.length;
  }
  let last;
  for (let k = 0; k < tries; k++) {
    try { return await downloadOnce(url, file, { maxMb, idleMs, referer, allowPrivate }); } catch (e) {
      last = e;
      if ((e.status && e.status < 500 && e.status !== 429) || /limit|refused/.test(e.message)) break;
      await new Promise((r) => setTimeout(r, 1000 * (k + 1)));
    }
  }
  throw last;
}

async function downloadOnce(url, file, { maxMb, idleMs, referer, allowPrivate }) {
  const ctl = new AbortController();
  let idle = setTimeout(() => ctl.abort(new Error(`no data for ${idleMs / 1000} s`)), idleMs);
  const poke = () => { clearTimeout(idle); idle = setTimeout(() => ctl.abort(new Error(`no data for ${idleMs / 1000} s`)), idleMs); };
  try {
    let r;
    let at = url;
    for (let hop = 0; ; hop++) { // follow redirects by hand, checking every address
      if (!allowPrivate) await assertPublic(at);
      r = await fetch(at, { headers: { 'User-Agent': UA, ...(referer ? { Referer: referer } : {}) }, redirect: 'manual', signal: ctl.signal });
      if (r.status < 300 || r.status >= 400 || !r.headers.get('location')) break;
      if (hop >= 5) throw new Error('too many redirects');
      at = new URL(r.headers.get('location'), at).href;
      await r.body?.cancel().catch(() => {});
    }
    if (!r.ok || !r.body) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
    const cap = maxMb * 1e6;
    const len = Number(r.headers.get('content-length') || 0);
    if (len > cap) throw new Error(`${(len / 1e6).toFixed(0)} MB is over the ${maxMb} MB limit (--max-mb)`);
    let n = 0;
    const count = new TransformStream({
      transform(chunk, c) {
        poke();
        n += chunk.byteLength;
        if (n > cap) c.error(new Error(`over the ${maxMb} MB limit (--max-mb)`)); else c.enqueue(chunk);
      },
    });
    const part = `${file}.part`;
    try {
      await pipeline(Readable.fromWeb(r.body.pipeThrough(count)), fs.createWriteStream(part));
      fs.renameSync(part, file);
    } catch (e) {
      fs.rmSync(part, { force: true });
      throw e;
    }
    return n;
  } finally { clearTimeout(idle); }
}

const X_HOSTS = new Set(['x.com', 'twitter.com', 'fxtwitter.com', 'fixupx.com', 'vxtwitter.com', 'fixvx.com']);
const MEDIA_EXT = /\.(mp4|mov|m4v|webm|mkv|gif|png|jpe?g|webp|avif)$/i;

/** What kind of link this is: x | telegram | direct | other (null when it is not an http(s) URL). */
export function parseLink(s) {
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|mobile|m|d)\./, '');
  const st = u.pathname.match(/\/status(?:es)?\/(\d+)/);
  if (X_HOSTS.has(host) && st) {
    const user = u.pathname.split('/')[1];
    return { kind: 'x', id: st[1], user: user && user !== 'i' ? user : null, url: s };
  }
  if (host === 't.me' || host === 'telegram.me') {
    const m = u.pathname.match(/^\/(?:s\/)?([A-Za-z0-9_]{4,})\/(\d+)/);
    if (m) return { kind: 'telegram', channel: m[1], post: m[2], url: s };
  }
  if (MEDIA_EXT.test(u.pathname)) return { kind: 'direct', url: s };
  return { kind: 'other', url: s, host };
}

const dims = (url) => { const m = String(url).match(/\/(\d{2,5})x(\d{2,5})\//); return m ? [Number(m[1]), Number(m[2])] : [0, 0]; };
/**
 * The MP4 to study: the highest bitrate whose long side is at most 1920 px (else the smallest one above), with the
 * next smaller versions as `alts` in case the first download fails.
 */
function bestMp4(variants) {
  const mp4 = variants.filter((v) => /mp4/.test(v.type || '') && v.url).map((v) => {
    const [w, h] = v.w ? [v.w, v.h] : dims(v.url);
    return { ...v, w, h, long: Math.max(w, h) };
  });
  if (!mp4.length) return null;
  const fit = mp4.filter((v) => !v.long || v.long <= 1920).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  const big = mp4.filter((v) => v.long > 1920).sort((a, b) => a.long - b.long);
  const [first, ...rest] = [...fit, ...big];
  return { url: first.url, w: first.w, h: first.h, alts: rest.filter((v) => (v.long || 0) >= 360).map((v) => v.url) };
}

const xToken = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');

function fromSyndication(j) {
  const media = (d) => (d?.mediaDetails || []).map((m) => (m.type === 'photo'
    ? { type: 'photo', url: `${m.media_url_https}?name=orig` }
    : { type: 'video', ...bestMp4((m.video_info?.variants || []).map((v) => ({ type: v.content_type, url: v.url, bitrate: v.bitrate }))) }))
    .filter((m) => m.url);
  return {
    author: j.user?.screen_name, text: j.text || '', date: j.created_at, media: media(j),
    quote: j.quoted_tweet ? { author: j.quoted_tweet.user?.screen_name, text: j.quoted_tweet.text || '', media: media(j.quoted_tweet) } : null,
  };
}
function fromFx(t) {
  const media = (x) => [
    ...(x?.media?.videos || []).map((v) => ({ type: 'video', ...(bestMp4((v.variants || []).map((z) => ({ type: z.content_type, url: z.url, bitrate: z.bitrate }))) || { url: v.url, w: v.width, h: v.height }) })),
    ...(x?.media?.photos || []).map((p) => ({ type: 'photo', url: p.url })),
  ].filter((m) => m.url);
  return {
    author: t.author?.screen_name, text: t.text || '', date: t.created_at, media: media(t),
    quote: t.quote ? { author: t.quote.author?.screen_name, text: t.quote.text || '', media: media(t.quote) } : null,
  };
}
const hasMedia = (p) => p.media.length || p.quote?.media?.length;

async function resolveX(link, { thirdParty = true } = {}) {
  const tried = [];
  let found = null;
  try {
    const j = await getJson(`https://cdn.syndication.twimg.com/tweet-result?id=${link.id}&lang=en&token=${xToken(link.id)}`);
    if (j && (j.text !== undefined || j.mediaDetails)) found = { ...fromSyndication(j), via: 'X embed endpoint' };
    else tried.push('X embed endpoint: no post (deleted, private or age-restricted)');
  } catch (e) { tried.push(`X embed endpoint: ${why(e)}`); }
  // FxEmbed also reads videos that X's endpoint leaves in a card (ads, amplify posts)
  if (thirdParty && !(found && hasMedia(found))) {
    try {
      const j = await getJson(`https://api.fxtwitter.com/status/${link.id}`);
      if (j?.tweet) { const fx = { ...fromFx(j.tweet), via: 'FxEmbed API (api.fxtwitter.com)' }; if (!found || hasMedia(fx)) found = fx; } else tried.push(`FxEmbed: ${j?.message || 'no post'}`);
    } catch (e) { tried.push(`FxEmbed: ${why(e)}`); }
  }
  return found || { error: tried.join('; ') };
}

const unescapeHtml = (s) => s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

async function resolveTelegram(link) {
  try {
    const html = await getText(`https://t.me/${link.channel}/${link.post}?embed=1&mode=tme`);
    const media = [
      ...[...html.matchAll(/<video[^>]+src="([^"]+)"/g)].map((m) => ({ type: 'video', url: m[1].replace(/&amp;/g, '&') })),
      ...[...html.matchAll(/tgme_widget_message_photo_wrap[^>]+background-image:url\('([^']+)'\)/g)].map((m) => ({ type: 'photo', url: m[1] })),
    ];
    const text = unescapeHtml((html.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
    const tooBig = /Media is too big|VIEW IN TELEGRAM/i.test(html) && !media.some((m) => m.type === 'video');
    return { author: link.channel, text, media, via: 't.me embed page', note: tooBig ? 'the video is too big for the web preview: ask for the file' : null };
  } catch (e) { return { error: `t.me embed page: ${why(e)}` }; }
}

export function hasYtDlp() {
  const r = spawnSync('yt-dlp', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function ytDlp(url, dir, maxMb) {
  // H.264 first: an AV1 file probes fine but ffmpeg builds without an AV1 decoder cannot read its frames
  const r = spawnSync('yt-dlp', ['--no-playlist', '--no-progress', '--no-warnings', '--encoding', 'utf-8', '--max-filesize', `${maxMb}M`,
    '-S', 'vcodec:h264,res:1080,acodec:m4a', '--merge-output-format', 'mp4',
    '-o', path.join(dir, '%(extractor_key)s-%(id)s.%(ext)s'), '--print', 'after_move:filepath', '--', url],
  { encoding: 'utf8', maxBuffer: 1 << 24, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  const printed = (r.stdout || '').trim().split('\n').filter(Boolean).pop();
  const file = printed && [printed, path.join(dir, path.basename(printed))].find((f) => fs.existsSync(f));
  if (r.status !== 0 || !file) return { error: `yt-dlp: ${(r.stderr || '').trim().split('\n').pop() || `exit ${r.status}`}` };
  return { files: [file] };
}

const safe = (s) => String(s || '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'ref';
const extOf = (url, type) => {
  const m = new URL(url).pathname.match(/\.(\w{2,4})$/);
  if (m) return m[1].toLowerCase();
  return type === 'photo' ? 'jpg' : 'mp4';
};
const IMAGE = new Set(['png', 'jpg', 'gif', 'webp', 'avif']);
const VIDEO = new Set(['mp4', 'mov', 'webm', 'gif']);

/**
 * Fetches the media behind one link into `dir` and writes a <name>.post.json next to it (the post text often names
 * the tool or the style). Files already there are reused. Returns { files, post?, error?, note? }.
 */
export async function fetchLink(s, dir, { thirdParty = true, maxMb = 300, log = console.log } = {}) {
  const link = parseLink(s);
  if (!link) return { error: 'not a link' };
  fs.mkdirSync(dir, { recursive: true });
  const allowPrivate = await isPrivateUrl(link.url); // the user's own link to a local server is theirs to give
  let post;
  let base;
  if (link.kind === 'x') {
    post = await resolveX(link, { thirdParty });
    base = `x-${safe(post.author || link.user || 'post')}-${link.id}`;
  } else if (link.kind === 'telegram') {
    post = await resolveTelegram(link);
    base = `tg-${safe(link.channel)}-${link.post}`;
  } else if (link.kind === 'direct') {
    const p = new URL(link.url).pathname;
    // the address's hash in the name: two sites' "video.mp4" are two files
    base = `${safe(path.basename(p).replace(/\.\w+$/, '')).slice(0, 40)}-${crypto.createHash('sha1').update(link.url).digest('hex').slice(0, 8)}`;
    post = { media: [{ type: /\.(png|jpe?g|webp|avif)$/i.test(p) ? 'photo' : 'video', url: link.url }], via: 'direct link' };
  } else {
    const v = hasYtDlp();
    if (!v) return { error: `${link.host} is not fetched without yt-dlp (not installed; do not install it without the user's consent)` };
    log(`  ${link.host}: yt-dlp ${v}`);
    return ytDlp(link.url, dir, maxMb);
  }
  if (post.error) return { error: post.error };
  let media = post.media || [];
  let from = post.author;
  if (!media.length && post.quote?.media?.length) { media = post.quote.media; from = post.quote.author; }
  const files = [];
  const errors = [];
  let i = 0;
  for (const m of media) {
    i++;
    const file = path.join(dir, `${base}${media.length > 1 ? `-${i}` : ''}.${extOf(m.url, m.type)}`);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) { log(`  already here: ${file}`); files.push(file); continue; }
    // download() retries network errors itself; if a version still fails, the next smaller version of the same video
    const tries = [m.url, ...(m.alts || []).slice(0, 2)];
    let last = null;
    for (let k = 0; k < tries.length; k++) {
      try {
        if (k) log('  retrying with a smaller version of the same video');
        const n = await download(tries[k], file, { maxMb, allowPrivate });
        const kind = sniff(file);
        if (!kind || !(m.type === 'photo' ? IMAGE : VIDEO).has(kind)) {
          fs.rmSync(file, { force: true });
          throw new Error(`not a ${m.type === 'photo' ? 'picture' : 'video'} (the server sent ${kind || 'something else, often a web page'})`);
        }
        const [w, h] = k === 0 && m.w ? [m.w, m.h] : dims(tries[k]);
        log(`  saved ${file} (${(n / 1e6).toFixed(1)} MB${w ? `, ${w}×${h}` : ''})`);
        files.push(file);
        last = null;
        break;
      } catch (e) {
        last = e;
        if (/limit|refused|not a /.test(e.message)) break; // too big stays too big; a web page stays a web page
      }
    }
    if (last) errors.push(`${m.url}: ${why(last)}`);
  }
  const meta = {
    link: link.url, via: post.via, author: post.author, text: post.text, date: post.date,
    mediaFrom: from !== post.author ? `quoted post by @${from}` : undefined,
    quote: post.quote ? { author: post.quote.author, text: post.quote.text } : undefined,
    files: files.map((f) => path.basename(f)), fetched: new Date().toISOString(),
  };
  if (files.length || post.text) fs.writeFileSync(path.join(dir, `${base}.post.json`), JSON.stringify(meta, null, 1));
  const note = [post.note, !media.length ? 'the post has no video or image' : null, ...errors].filter(Boolean).join('; ') || null;
  return { files, post: meta, note, error: files.length ? null : note || 'nothing downloaded' };
}
