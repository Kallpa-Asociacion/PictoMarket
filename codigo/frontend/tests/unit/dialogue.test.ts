import { describe, expect, it } from 'vitest';
import { INTRO_STEPS, focusSteps } from '../../src/content/intro';
import { market } from '../../src/data/market';
import { DIALOGUE, praise } from '../../src/domain/dialogue';
import {
  chooseProduct,
  startGame,
  voiceText,
  type HelpAction,
} from '../../src/domain/game';
import { guideLineFromGame } from '../../src/domain/guide';
import { allSpokenSentences, splitSentences } from '../../src/voice/phrases';

const lunch = market.retos[1];
const [first, second] = lunch.lista_correcta;
const [d1] = lunch.distractores;
const fresh = () => startGame(market, 1, 0);
const force = (action: HelpAction) => () => action;

describe('diálogos de Inti', () => {
  it('saluda y pide el primer producto', () => {
    expect(fresh().mensaje.texto).toBe(
      '¡Hola! Vamos a comprar para el almuerzo. Busca: pechuga de pollo.',
    );
  });
  it('varía el elogio para no repetirse', () => {
    const lines = [1, 2, 3, 4].map(praise);
    expect(new Set(lines).size).toBe(4);
    expect(lines[0]).toBe('¡Muy bien!');
    let state = fresh();
    const heard: string[] = [];
    for (const id of lunch.lista_correcta) {
      state = chooseProduct(market, state, id, 10);
      heard.push(splitSentences(state.mensaje.texto)[0]);
    }
    expect(heard).toEqual(lines);
    expect(state.mensaje.texto).toContain('¡Lo lograste! Compraste todo.');
  });
  it('el nombre del producto empieza en mayúscula', () => {
    const next = chooseProduct(market, fresh(), first, 10);
    expect(next.mensaje.texto).toBe(
      '¡Muy bien! Pechuga de pollo va al carrito. Ahora busca: papa.',
    );
  });
  it('cada ayuda es positiva y distinta, y recuerda qué hacer', () => {
    const texts = (['a1', 'a2', 'a3', 'a4'] as const).map(
      (action) =>
        chooseProduct(market, fresh(), d1, 10, force(action)).mensaje.texto,
    );
    expect(new Set(texts).size).toBe(4);
    expect(texts[0]).toContain('no está en tu lista. Mira en');
    for (const text of texts.slice(1))
      expect(text.toLowerCase()).toContain('pechuga de pollo');
    expect(texts[3]).toContain('Inténtalo otra vez');
    for (const text of texts) expect(text).not.toMatch(/mal|incorrecto|error/i);
  });
  it('la nube celebra con el mismo elogio que se escucha', () => {
    let state = chooseProduct(market, fresh(), first, 10);
    state = chooseProduct(market, state, second, 20);
    expect(guideLineFromGame(state).text).toBe(praise(2));
  });
  it('las líneas de la presentación son cortas', () => {
    const plan = {
      first: { id: first, name: 'PECHUGA DE POLLO' },
      second: { id: second, name: 'PAPA' },
      decoy: d1,
    };
    for (const step of [...INTRO_STEPS, ...focusSteps(plan)])
      for (const sentence of splitSentences(step.text))
        expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(11);
    expect(DIALOGUE.home).toContain('Soy Inti');
  });
});

describe('catálogo de frases para grabar', () => {
  const catalog = new Set(allSpokenSentences().map((s) => s.key));
  const missing = (text: string) =>
    splitSentences(voiceText(text)).filter((key) => !catalog.has(key));

  it('no tiene frases repetidas ni vacías ni emojis', () => {
    const all = allSpokenSentences();
    expect(new Set(all.map((s) => s.key)).size).toBe(all.length);
    for (const { key, text } of all) {
      expect(key).not.toBe('');
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
  it('cubre saludo, presentación y demostración en ambos escenarios', () => {
    expect(missing(DIALOGUE.home)).toEqual([]);
    for (const step of INTRO_STEPS) expect(missing(step.text)).toEqual([]);
    for (const challenge of market.retos) {
      const [a, b] = challenge.lista_correcta;
      const plan = {
        first: { id: a, name: market.catalogo[a].nombre },
        second: { id: b, name: market.catalogo[b].nombre },
        decoy: challenge.distractores[0],
      };
      for (const step of focusSteps(plan))
        expect(missing(step.text)).toEqual([]);
    }
  });
  it('cubre todo lo que puede decir el juego en 600 partidas al azar', () => {
    let seed = 7;
    const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    const pick = <T>(values: T[]) =>
      values[Math.floor(random() * values.length)];
    const gaps = new Set<string>();
    for (let game = 0; game < 600; game++) {
      let state = startGame(market, game % market.retos.length, 0);
      for (const key of missing(state.mensaje.texto)) gaps.add(key);
      for (let turn = 0; turn < 40 && state.items_restantes.length; turn++) {
        const action = pick(['a1', 'a2', 'a3', 'a4'] as const);
        const wanted = random() < 0.4 ? state.items_restantes : null;
        const product = pick(wanted ?? state.productos_visibles);
        state = chooseProduct(market, state, product, turn, force(action));
        for (const key of missing(state.mensaje.texto)) gaps.add(key);
      }
    }
    expect([...gaps]).toEqual([]);
  });
  it('grabar por oración cuesta mucho menos que grabar cada mensaje', () => {
    const characters = allSpokenSentences().reduce(
      (sum, s) => sum + s.text.length,
      0,
    );
    // Budget guard: if the dialogues grow past this, review the cost.
    expect(characters).toBeLessThan(6000);
  });
});
