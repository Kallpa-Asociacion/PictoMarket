import { describe, expect, it } from 'vitest';
import { market } from '../../src/data/market';
import { chooseProduct, startGame } from '../../src/domain/game';
import {
  GUIDE_NAME,
  MOOD_BADGE,
  guideLineFromGame,
} from '../../src/domain/guide';
import { INTRO_STEPS } from '../../src/content/intro';

function fresh() {
  return startGame(market, 1, 0);
}
const challenge = market.retos[1];
const [first, second] = challenge.lista_correcta;
const [d1, d2, d3] = challenge.distractores;

describe('guideLineFromGame', () => {
  it('saluda al iniciar y usa el id del mensaje', () => {
    const state = fresh();
    expect(guideLineFromGame(state)).toEqual({
      id: state.mensaje.id,
      mood: 'greet',
      text: '¡Vamos de compras!',
      autoHide: true,
    });
  });
  it('celebra un acierto cuando quedan productos', () => {
    const state = chooseProduct(market, fresh(), first, 10);
    expect(guideLineFromGame(state)).toMatchObject({
      id: state.mensaje.id,
      mood: 'celebrate',
      text: '¡Muy bien!',
      autoHide: true,
    });
  });
  it('celebra la compra completa', () => {
    let state = fresh();
    for (const id of challenge.lista_correcta)
      state = chooseProduct(market, state, id, 10);
    expect(state.items_restantes).toHaveLength(0);
    expect(guideLineFromGame(state)).toMatchObject({
      mood: 'celebrate',
      text: '¡Compraste todo!',
    });
  });
  it('a1: invita a mirar la pista, sin ocultarse solo', () => {
    const state = chooseProduct(market, fresh(), d1, 10);
    expect(guideLineFromGame(state)).toMatchObject({
      mood: 'think',
      text: 'Mira la pista 💡',
      autoHide: false,
    });
  });
  it('a2: anima', () => {
    let state = chooseProduct(market, fresh(), d1, 10);
    state = chooseProduct(market, state, d2, 20);
    expect(guideLineFromGame(state)).toMatchObject({
      mood: 'encourage',
      text: '¡Tú puedes!',
      autoHide: false,
    });
  });
  it('a3: señala el producto', () => {
    let state = chooseProduct(market, fresh(), d1, 10);
    state = chooseProduct(market, state, d2, 20);
    state = chooseProduct(market, state, d3, 30);
    expect(state.log_eventos.at(-1)?.accion_agente).toBe('a3');
    expect(guideLineFromGame(state)).toMatchObject({
      mood: 'point',
      text: '¡Está aquí abajo!',
    });
  });
  it('a4: anima a intentarlo otra vez sin hablar de pista', () => {
    const state = chooseProduct(market, fresh(), d1, 10, () => 'a4');
    expect(guideLineFromGame(state)).toMatchObject({
      mood: 'encourage',
      text: '¡Inténtalo otra vez!',
      autoHide: false,
    });
  });
  it('es pura: no modifica el estado ni el log', () => {
    const state = chooseProduct(market, fresh(), d1, 10);
    const snapshot = JSON.stringify(state);
    guideLineFromGame(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it('tras un acierto el siguiente objetivo no cambia el log', () => {
    const state = chooseProduct(market, fresh(), first, 10);
    expect(state.items_restantes[0]).toBe(second);
    expect(state.log_eventos).toHaveLength(1);
  });
});

describe('constantes del guía', () => {
  it('tiene nombre y un badge por ánimo', () => {
    expect(GUIDE_NAME).toBe('Inti');
    expect(Object.keys(MOOD_BADGE).sort()).toEqual(
      ['celebrate', 'encourage', 'greet', 'point', 'think', 'explain'].sort(),
    );
  });
});

describe('pasos de la presentación', () => {
  it('son cinco y mantienen el orden de ánimos', () => {
    expect(INTRO_STEPS.map((step) => step.mood)).toEqual([
      'greet',
      'explain',
      'explain',
      'encourage',
      'celebrate',
    ]);
    expect(new Set(INTRO_STEPS.map((step) => step.id)).size).toBe(5);
  });
  it('todos los pictogramas existen en el catálogo', () => {
    for (const step of INTRO_STEPS)
      if (step.pictogram !== undefined)
        expect(market.catalogo[step.pictogram]).toBeDefined();
  });
  it('textos cortos para CAA', () => {
    for (const step of INTRO_STEPS)
      expect(step.text.split(/\s+/).length).toBeLessThanOrEqual(10);
  });
});
