import { existsSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import functionWords from '../../../../datos/pictogramas_funcion.json';
import { market } from '../../src/data/market';
import {
  chooseProduct,
  startGame,
  type HelpAction,
} from '../../src/domain/game';
import { FUNCTION_WORDS, pictoSentence } from '../../src/domain/pictoSentence';
import { PictoSentence } from '../../src/components/PictoSentence';

const labels = (state: ReturnType<typeof startGame>) =>
  pictoSentence(market, state).map((item) => item.label);
function fresh() {
  return startGame(market, 0, 0);
}
function wrongTouch(action: HelpAction) {
  const state = fresh();
  const wrong = state.productos_visibles.find(
    (id) => !state.items_restantes.includes(id),
  )!;
  return chooseProduct(market, state, wrong, 100, () => action);
}

describe('pictoSentence', () => {
  it('builds [BUSCAR] + [target] for the initial query', () => {
    const state = fresh();
    const target = state.items_restantes[0];
    const items = pictoSentence(market, state);
    expect(items.map((i) => i.kind)).toEqual(['function', 'product']);
    expect(items[0].label).toBe('BUSCAR');
    expect(items[1]).toMatchObject({
      id: target,
      label: market.catalogo[target].nombre,
    });
  });
  it('shows [MUY BIEN] + [CARRITO] + next query after a correct touch', () => {
    const state = fresh();
    const [first, second] = state.items_restantes;
    const next = chooseProduct(market, state, first, 100);
    expect(next.mensaje.tipo).toBe('exito');
    expect(labels(next).slice(0, 2)).toEqual(['MUY BIEN', 'CARRITO']);
    expect(pictoSentence(market, next).at(-1)).toMatchObject({ id: second });
  });
  it('a1 shows [BUSCAR] + the target category', () => {
    const state = wrongTouch('a1');
    const target = state.items_restantes[0];
    const category = market.categorias[market.catalogo[target].categoria];
    const items = pictoSentence(market, state);
    expect(items[0].label).toBe('BUSCAR');
    expect(items[1]).toMatchObject({
      kind: 'category',
      label: category.nombre,
      icon: category.icono,
    });
  });
  it('a2 shows [AYUDA] + [QUITAR]', () => {
    expect(labels(wrongTouch('a2'))).toEqual(['AYUDA', 'QUITAR']);
  });
  it('a3 shows [MIRAR] + [AQUÍ] + [target]', () => {
    const state = wrongTouch('a3');
    const items = pictoSentence(market, state);
    expect(items.map((i) => i.label).slice(0, 2)).toEqual(['MIRAR', 'AQUÍ']);
    expect(items[2].id).toBe(state.items_restantes[0]);
  });
  it('a4 shows [OTRA VEZ] + [BUSCAR] + [target]', () => {
    const state = wrongTouch('a4');
    const items = pictoSentence(market, state);
    expect(items.map((i) => i.label).slice(0, 2)).toEqual([
      'OTRA VEZ',
      'BUSCAR',
    ]);
    expect(items[2].id).toBe(state.items_restantes[0]);
  });
  it('is empty when the purchase is complete', () => {
    let state = fresh();
    for (const id of [...state.items_restantes])
      state = chooseProduct(market, state, id, 100);
    expect(labels(state)).toEqual(['MUY BIEN', 'CARRITO']);
  });
});

describe('function pictogram data', () => {
  const ids = Object.values(functionWords.funcion).map((entry) => entry.id);
  it('every referenced id is in the data file and its PNG exists', () => {
    for (const word of Object.values(FUNCTION_WORDS)) {
      expect(ids).toContain(word.id);
    }
    for (const id of ids) {
      expect(
        existsSync(`${process.cwd()}/public/pictograms/${id}.png`),
        `${id}.png`,
      ).toBe(true);
    }
  });
  it('every entry cites its ARASAAC source', () => {
    for (const entry of Object.values(functionWords.funcion))
      expect(entry.fuente).toMatch(/^https:\/\/api\.arasaac\.org\//);
  });
});

describe('PictoSentence component', () => {
  it('is hidden from assistive technology and renders every item', () => {
    const state = wrongTouch('a3');
    const { container } = render(<PictoSentence data={market} state={state} />);
    const root = container.querySelector('.picto-sentence');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root!.querySelectorAll('.picto-item')).toHaveLength(3);
    root!
      .querySelectorAll('img')
      .forEach((img) => expect(img).toHaveAttribute('alt', ''));
  });
});
