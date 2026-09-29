// Code that runs inside a site's page, shared by site-kit.mjs and ui-shot.mjs (serialised with call(): no closures).

/** A bot-check page instead of the site? */
export function botCheck() {
  const t = `${document.title} ${String(document.body?.innerText || '').slice(0, 3000)}`;
  // the phrases of a challenge page — not a bare "captcha", which also sits in footers ("protected by reCAPTCHA")
  return /just a moment\.\.\.|attention required|checking your browser|verify you are human|are you a robot|enable javascript and cookies to continue|ddos-guard|complete the captcha|solve the captcha|проверка браузера|вы не робот|подтвердите, что вы (не робот|человек)|пройдите капчу/i.test(t);
}

// hides consent banners, chat bubbles and modal dialogs for the screenshots only (nothing is clicked or accepted)
export function hideOverlays() {
  let n = 0;
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.position !== 'fixed' && s.position !== 'sticky') continue;
    const id = `${el.id} ${typeof el.className === 'string' ? el.className : ''}`;
    const txt = String(el.innerText || '').slice(0, 500);
    const r = el.getBoundingClientRect();
    const consent = /cookie|куки|consent|gdpr|согласи|персональных данных/i.test(`${txt} ${id}`) && r.height < innerHeight * 0.7;
    const chat = /jivo|jdiv|intercom|crisp|tawk|carrot|chatra|livechat|b24-|bitrix|chat-widget|widget-button|callback|whatsapp-button/i.test(id);
    const modal = el.getAttribute('aria-modal') === 'true' || (el.getAttribute('role') === 'dialog' && r.width * r.height > innerWidth * innerHeight * 0.2);
    if (consent || chat || modal) { el.style.setProperty('visibility', 'hidden', 'important'); n++; }
  }
  document.querySelectorAll('iframe[src*="jivo"], iframe[src*="intercom"], iframe[src*="tawk"], #jivo-iframe-container, jdiv')
    .forEach((el) => { el.style.setProperty('visibility', 'hidden', 'important'); n++; });
  return n;
}

/** `fn(arg)` as an expression for Runtime.evaluate. */
export const call = (fn, arg) => `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`;
