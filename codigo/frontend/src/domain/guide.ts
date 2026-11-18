import type { GameState } from './game';

// Single place to rename the guide character.
export const GUIDE_NAME = 'Inti';

export type GuideMood =
  'greet' | 'explain' | 'celebrate' | 'encourage' | 'point' | 'think';

export interface GuideLine {
  /** Stable id: restarts the bubble animation and the voice reading. */
  id: string;
  mood: GuideMood;
  /** Short on purpose (about 8 words): the full text lives in the board. */
  text: string;
  /** Success/greeting bubbles shrink to the portrait; hints stay visible. */
  autoHide?: boolean;
}

// Emoji overlaid on the portrait for each mood.
export const MOOD_BADGE: Record<GuideMood, string> = {
  greet: '👋',
  explain: '☝️',
  celebrate: '🎉',
  encourage: '💪',
  point: '👇',
  think: '💡',
};

const HINT_BY_ACTION = {
  a1: { mood: 'think', text: 'Mira la pista 💡' },
  a2: { mood: 'encourage', text: '¡Tú puedes!' },
  a3: { mood: 'point', text: '¡Está aquí abajo!' },
  a4: { mood: 'encourage', text: '¡Inténtalo otra vez!' },
} as const;

// Derives the guide's line from the game message. Pure: it neither creates
// game state nor writes to the event log.
export function guideLineFromGame(state: GameState): GuideLine {
  const { mensaje } = state;
  if (mensaje.tipo === 'inicio')
    return {
      id: mensaje.id,
      mood: 'greet',
      text: '¡Vamos de compras!',
      autoHide: true,
    };
  if (mensaje.tipo === 'exito')
    return {
      id: mensaje.id,
      mood: 'celebrate',
      text: state.items_restantes.length ? '¡Muy bien!' : '¡Compraste todo!',
      autoHide: true,
    };
  const action = state.log_eventos.at(-1)?.accion_agente;
  const hint =
    action === 'a2' || action === 'a3' || action === 'a4'
      ? HINT_BY_ACTION[action]
      : HINT_BY_ACTION.a1;
  return { id: mensaje.id, ...hint, autoHide: false };
}
