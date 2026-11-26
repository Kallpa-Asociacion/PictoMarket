import { describe, expect, it } from 'vitest';
import { INTI_VISIBLE, placeTour, type Box } from '../../src/guide/tourLayout';

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/** Empty space between two boxes. */
const gap = (a: Box, b: Box) =>
  Math.hypot(
    Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)),
    Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h)),
  );

const screens = {
  escritorio: {
    view: { w: 1280, h: 800 },
    card: { w: 460, h: 220 },
    inti: { w: 394, h: 320 },
    targets: {
      lista: { x: 950, y: 130, w: 290, h: 330 },
      pizarra: { x: 24, y: 118, w: 882, h: 210 },
      billetera: { x: 950, y: 475, w: 290, h: 140 },
      estante: { x: 38, y: 410, w: 855, h: 175 },
    },
  },
  movil: {
    view: { w: 375, h: 812 },
    card: { w: 351, h: 225 },
    inti: { w: 180, h: 146 },
    targets: {
      // On phones the explained element is scrolled to the top.
      pizarra: { x: 14, y: 20, w: 346, h: 190 },
      producto: { x: 30, y: 40, w: 100, h: 135 },
    },
  },
};

describe('posición de Inti en la presentación', () => {
  for (const [screen, { view, card, inti, targets }] of Object.entries(screens))
    for (const [name, target] of Object.entries(targets))
      it(`${screen}: junto al globo y sin tapar ${name}`, () => {
        const layout = placeTour({ target, card, inti, view });
        const cardBox = { ...layout.card, ...card };
        const visible = {
          x: layout.inti.x + (inti.w * (1 - INTI_VISIBLE)) / 2,
          y: layout.inti.y,
          w: inti.w * INTI_VISIBLE,
          h: inti.h,
        };
        // Near the balloon, without sitting on it.
        expect(gap(visible, cardBox)).toBeLessThanOrEqual(24);
        expect(overlap(visible, cardBox)).toBe(0);
        // Both fully on screen.
        for (const box of [cardBox, visible]) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.x + box.w).toBeLessThanOrEqual(view.w);
          expect(box.y + box.h).toBeLessThanOrEqual(view.h);
        }
        // What is being explained stays visible.
        expect(overlap(cardBox, target)).toBe(0);
        expect(overlap(visible, target)).toBe(0);
      });

  it('si no hay sitio para los dos, el texto nunca tapa lo explicado', () => {
    const { view, card, inti } = screens.movil;
    const target = { x: 14, y: 300, w: 346, h: 190 };
    const layout = placeTour({ target, card, inti, view });
    expect(overlap({ ...layout.card, ...card }, target)).toBe(0);
  });
  it('mira hacia el globo: en espejo cuando queda a su derecha', () => {
    for (const { view, card, inti, targets } of Object.values(screens))
      for (const target of Object.values(targets)) {
        const layout = placeTour({ target, card, inti, view });
        expect(layout.mirror).toBe(
          layout.inti.x + inti.w / 2 > layout.card.x + card.w / 2 + 1,
        );
      }
  });
  it('sin elemento que explicar, el conjunto queda centrado', () => {
    const { view, card, inti } = screens.escritorio;
    const layout = placeTour({ target: null, card, inti, view });
    const left = Math.min(layout.card.x, layout.inti.x);
    const right = Math.max(layout.card.x + card.w, layout.inti.x + inti.w);
    expect(Math.abs((left + right) / 2 - view.w / 2)).toBeLessThan(60);
    expect(layout.spot).toEqual({ x: 640, y: 400, w: 0, h: 0 });
  });
  it('evita tapar los elementos que el paso quiere mostrar', () => {
    const { view, card, inti } = screens.movil;
    const target = { x: 10, y: 250, w: 355, h: 540 };
    const product = { x: 200, y: 620, w: 145, h: 135 };
    const layout = placeTour({
      target,
      card,
      inti,
      view,
      avoid: [product],
    });
    expect(
      overlap(
        { x: layout.inti.x + 22, y: layout.inti.y, w: 136, h: inti.h },
        product,
      ),
    ).toBe(0);
  });
});
