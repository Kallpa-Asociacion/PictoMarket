import type { GuideMood } from '../domain/guide';

export interface IntroStep {
  id: string;
  mood: GuideMood;
  /** Short heading of the dialog. */
  title: string;
  /** What the dialog says and the voice reads. */
  text: string;
  /** Catalog id; must exist in `market.catalogo`. */
  pictogram?: number;
  /** CSS selector of the on-screen element Inti walks to; none = centered. */
  target?: string;
}

// The guide presents these on the real game screen: it moves next to each
// target while the rest of the screen is dimmed.
export const INTRO_STEPS: IntroStep[] = [
  {
    id: 'hello',
    mood: 'greet',
    title: '¡Hola! Soy Inti',
    text: 'Te acompaño en el mercado.',
    pictogram: 2462,
  },
  {
    id: 'list',
    mood: 'explain',
    title: 'Mira la lista',
    text: 'Aquí ves qué vamos a comprar.',
    target: '.list-panel',
  },
  {
    id: 'touch',
    mood: 'explain',
    title: 'Toca el producto',
    text: 'Toca el dibujo del producto que te pido.',
    target: '.shelf-row',
  },
  {
    id: 'help',
    mood: 'encourage',
    title: 'Si te equivocas, te ayudo',
    text: 'Aquí te digo qué buscar y te doy pistas.',
    target: '.instruction-board',
  },
  {
    id: 'go',
    mood: 'celebrate',
    title: '¡A comprar!',
    text: 'Cuida tus monedas. ¡Vamos!',
    target: '.wallet-panel',
  },
];
