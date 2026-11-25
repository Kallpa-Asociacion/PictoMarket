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
  /** Demo level: green hint on every product still on the list. */
  demo?: 'list';
  /** Hint shown by Inti: green ("touch this") or amber ("here it is"). */
  hint?: { ids: number[]; tone: 'target' | 'category' };
  /** Moves on by itself after a short pause. */
  auto?: boolean;
  /** The child has to touch this product; there is no "Siguiente". */
  touch?: number;
  /** The touch is a real purchase (otherwise it is only part of the demo). */
  buys?: boolean;
  /** Where another product leads; without it, other touches are ignored. */
  onWrong?: string;
  /** CSS selector of elements Inti should try not to cover. */
  avoid?: string;
}

// The guide presents these on the real game screen: it moves next to each
// target while the rest of the screen is dimmed.
export const INTRO_STEPS: IntroStep[] = [
  {
    id: 'hello',
    mood: 'greet',
    title: '¡Hola! Soy Inti',
    text: '¡Hola! Soy Inti. Te acompaño en el mercado.',
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
    title: 'Toca estos productos',
    text: 'Los productos verdes están en tu lista.',
    target: '.shelves',
    demo: 'list',
    avoid: '.product-card.target-hint',
  },
  {
    id: 'help',
    mood: 'encourage',
    title: 'Si te equivocas, te ayudo',
    text: 'Aquí te digo qué buscar. También te doy pistas.',
    target: '.instruction-board',
  },
  {
    id: 'go',
    mood: 'celebrate',
    title: '¡A comprar!',
    text: 'Cuida tus monedas. ¡Vamos a comprar!',
    target: '.wallet-panel',
  },
];

// Right after the tour, Inti plays the first purchases with the child:
// the first product of the list (right touch, it goes to the cart), then the
// second one with a planned mistake to show the amber hint and how products
// are taken away; at the end, the hint board and "now you can do it alone".
export interface FocusPlan {
  first: { id: number; name: string };
  second?: { id: number; name: string };
  /** A product that is not on the list, touched on purpose. */
  decoy?: number;
}

const card = (id: number) => `.product-card[data-product-id="${id}"]`;
const green = (id: number) => ({ ids: [id], tone: 'target' as const });
const amber = (id: number) => ({ ids: [id], tone: 'category' as const });

export function focusSteps({ first, second, decoy }: FocusPlan): IntroStep[] {
  const one = first.name.toLowerCase();
  const steps: IntroStep[] = [
    {
      id: 'focus-list',
      mood: 'explain',
      title: 'Primero, mira tu lista',
      text: 'Mira. Esta es la lista de hoy.',
      target: '.list-panel',
      auto: true,
    },
    {
      id: 'focus-item',
      mood: 'explain',
      title: `Lo primero: ${one}`,
      text: `Primero vamos a comprar: ${one}.`,
      target: '.list-item.current',
      auto: true,
    },
    {
      id: 'focus-product',
      mood: 'encourage',
      title: `Busca: ${one}`,
      text: 'Está marcado en verde. ¡Tócalo!',
      target: card(first.id),
      hint: green(first.id),
      touch: first.id,
      buys: true,
    },
    {
      id: 'focus-good',
      mood: 'celebrate',
      title: '¡Muy bien!',
      text: 'El verde significa que ya está en tu carrito.',
      target: card(first.id),
    },
  ];
  if (second) {
    const two = second.name.toLowerCase();
    steps.push(
      {
        id: 'focus-list-done',
        mood: 'explain',
        title: 'Tu lista se actualiza',
        text: '¡Mira! Tu lista ya cambió.',
        target: '.list-panel',
        auto: true,
      },
      {
        id: 'focus-item-2',
        mood: 'explain',
        title: `Ahora sigue: ${two}`,
        text: `Ahora vamos a comprar: ${two}.`,
        target: '.list-item.current',
        auto: true,
      },
    );
    if (decoy !== undefined)
      steps.push(
        {
          id: 'focus-try-wrong',
          mood: 'think',
          title: '¿Y si te equivocas?',
          text: 'Vamos a probar. Toca este producto.',
          target: card(decoy),
          hint: green(decoy),
          touch: decoy,
        },
        {
          id: 'focus-wrong',
          mood: 'think',
          title: `Ese no es ${two}`,
          text: 'No pasa nada. El color ámbar te muestra dónde está.',
          target: card(second.id),
          hint: amber(second.id),
        },
        {
          id: 'focus-remove',
          mood: 'encourage',
          title: 'Si te equivocas, te ayudo',
          text: 'Para ayudarte, puedo quitar productos.',
          target: '.shelves',
          hint: amber(second.id),
        },
        {
          id: 'focus-retry',
          mood: 'encourage',
          title: `Toca: ${two}`,
          text: 'Está marcado en ámbar. ¡Tú puedes!',
          target: card(second.id),
          hint: amber(second.id),
          touch: second.id,
          buys: true,
          onWrong: 'focus-wrong',
        },
      );
    else
      steps.push({
        id: 'focus-retry',
        mood: 'encourage',
        title: `Toca: ${two}`,
        text: 'Está marcado en verde. ¡Tócalo!',
        target: card(second.id),
        hint: green(second.id),
        touch: second.id,
        buys: true,
      });
    steps.push({
      id: 'focus-good-2',
      mood: 'celebrate',
      title: '¡Muy bien!',
      text: `${second.name.charAt(0)}${two.slice(1)} ya está en tu carrito.`,
      target: card(second.id),
    });
  }
  steps.push(
    {
      id: 'focus-board',
      mood: 'explain',
      title: 'Las pistas cambian contigo',
      text: 'Como viste, el panel de pistas se actualiza mientras eliges.',
      target: '.instruction-board',
    },
    {
      id: 'focus-ready',
      mood: 'celebrate',
      title: '¡Ya estás listo!',
      text: 'Ahora te toca a ti. Yo te acompaño.',
    },
  );
  return steps;
}
