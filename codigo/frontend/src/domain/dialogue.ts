// Every line Inti says during the game lives here, so the dialogues can be
// edited in one place and the voice catalogue (src/voice/phrases.ts) can list
// everything that has to be recorded.
//
// Rules: short sentences with one idea each, positive wording (errorless
// learning), neutral Spanish, and the product name at the end of a sentence
// when possible. Each sentence is recorded once and reused, so changing a
// sentence means recording it again.

const PRAISE = ['¡Muy bien!', '¡Genial!', '¡Lo hiciste!', '¡Excelente!'];

/** Praise for the n-th purchase (1-based); rotates so Inti does not repeat. */
export const praise = (purchase: number) =>
  PRAISE[(Math.max(1, purchase) - 1) % PRAISE.length];

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

export const DIALOGUE = {
  home: '¡Hola! Soy Inti. Toca EMPEZAR y vamos al mercado.',
  start: (meal: string, product: string) =>
    `¡Hola! Vamos a comprar para el ${meal}. Busca: ${product}.`,
  bought: (purchase: number, product: string, next?: string) =>
    `${praise(purchase)} ${capitalize(product)} va al carrito. ${
      next ? `Ahora busca: ${next}.` : '¡Lo lograste! Compraste todo.'
    }`,
  categoryHint: (touched: string, icon: string, category: string) =>
    `${capitalize(touched)} no está en tu lista. Mira en ${icon} ${category}.`,
  removedProduct: (target: string) =>
    `Te ayudo: quité un producto. ¡Tú puedes! Busca: ${target}.`,
  pointing: (target: string) => `Te ayudo. Mira 👇 aquí está: ${target}.`,
  tryAgain: (target: string) => `¡Casi! Inténtalo otra vez. Busca: ${target}.`,
};
