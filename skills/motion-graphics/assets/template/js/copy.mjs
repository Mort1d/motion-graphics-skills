// Every word on screen and every contact, per language (?lang=xx picks one). Plain ESM: the score imports it too
// (typing clicks per character, one pop per word...). Facts only from the brief; placeholder contacts must be
// obviously fictional (+1 555-01xx numbers, *.example domains) unless the client gave real ones.
// @template-demo — replace with the brief's copy.
export const BRAND = 'NOVA'; // @param name
export const SLUG = 'nova-promo'; // @param slug  (output file names)
export const DEFAULT_LANG = 'en'; // @param lang

export const COPY = {
  en: {
    hook: ['MAKE', 'IT', 'MOVE.'],
    sub: 'Motion graphics, rendered from code',
    cards: [
      { from: 0, to: 60, unit: 'FPS', label: 'every frame, rendered' },
      { from: 1, to: 16, unit: '× BLUR', label: 'sub-frame motion blur' },
      { from: 128, to: 0, unit: 'SAMPLES', label: 'every sound, synthesised' },
    ],
    statement: ['EVERY FRAME.', 'EVERY BEAT.'],
    tagline: 'PROMO VIDEOS FROM CODE',
    cta: 'Your brand, in motion',
    contacts: [
      { icon: 'link', text: 'nova.example' },
      { icon: 'send', text: '@nova_example' },
      { icon: 'phone', text: '+1 (555) 010-0199' },
    ],
  },
  ru: {
    hook: ['ПУСТЬ', 'ВСЁ', 'ДВИЖЕТСЯ.'],
    sub: 'Моушн-графика, отрендеренная кодом',
    cards: [
      { from: 0, to: 60, unit: 'FPS', label: 'каждый кадр отрендерен' },
      { from: 1, to: 16, unit: '× BLUR', label: 'настоящий motion blur' },
      { from: 128, to: 0, unit: 'СЭМПЛОВ', label: 'весь звук синтезирован' },
    ],
    statement: ['КАЖДЫЙ КАДР.', 'КАЖДЫЙ БИТ.'],
    tagline: 'ПРОМО-РОЛИКИ ИЗ КОДА',
    cta: 'Ваш бренд в движении',
    contacts: [
      { icon: 'link', text: 'nova.example' },
      { icon: 'send', text: '@nova_example' },
      { icon: 'phone', text: '+1 (555) 010-0199' },
    ],
  },
};
