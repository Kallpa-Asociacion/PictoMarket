// Where the guided tour puts the spotlight, the speech balloon and Inti. The
// balloon and Inti move as one group: always together, next to what is being
// explained, without covering it. Pure geometry in viewport coordinates.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Size {
  w: number;
  h: number;
}
export interface TourLayout {
  spot: Box;
  card: { x: number; y: number };
  inti: { x: number; y: number };
  /** Inti stands right of the balloon and is mirrored to face it. */
  mirror: boolean;
}

/** Share of the drawing canvas that Inti actually fills (the rest is empty). */
export const INTI_VISIBLE = 0.76;
const GAP = 14;
const MARGIN = 10;
const PAD = 10;

// Relative preference: beside the balloon reads best, then under, then over.
const ARRANGEMENTS = [
  { name: 'left', cost: 0 },
  { name: 'right', cost: 0 },
  { name: 'below-left', cost: 1500 },
  { name: 'below-right', cost: 1500 },
  { name: 'above-left', cost: 2500 },
  { name: 'above-right', cost: 2500 },
] as const;

/** Balloon and Inti relative to the corner of the group they form. */
function group(
  name: (typeof ARRANGEMENTS)[number]['name'],
  card: Size,
  inti: Size,
) {
  const seen = inti.w * INTI_VISIBLE;
  if (name === 'left' || name === 'right') {
    const w = seen + GAP + card.w;
    const h = Math.max(card.h, inti.h);
    return {
      w,
      h,
      card: { x: name === 'left' ? seen + GAP : 0, y: h - card.h },
      inti: { x: name === 'left' ? 0 : card.w + GAP, y: h - inti.h },
    };
  }
  const w = Math.max(card.w, seen);
  const h = card.h + inti.h;
  const below = name.startsWith('below');
  return {
    w,
    h,
    card: { x: (w - card.w) / 2, y: below ? 0 : inti.h },
    inti: {
      x: name.endsWith('left') ? 0 : w - seen,
      y: below ? card.h : 0,
    },
  };
}

const area = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const distance = (a: Box, b: Box) =>
  Math.hypot(
    Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)),
    Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h)),
  );
const clamp = (value: number, max: number) =>
  Math.min(Math.max(MARGIN, value), Math.max(MARGIN, max));

export function placeTour({
  target,
  card,
  inti,
  view,
  avoid = [],
}: {
  target: Box | null;
  card: Size;
  inti: Size;
  view: Size;
  /** Elements the step wants to keep in sight (e.g. demo products). */
  avoid?: Box[];
}): TourLayout {
  const seen = inti.w * INTI_VISIBLE;
  // Empty canvas left of the drawing.
  const inset = (inti.w - seen) / 2;
  const spot = target
    ? {
        x: target.x - PAD,
        y: target.y - PAD,
        w: target.w + PAD * 2,
        h: target.h + PAD * 2,
      }
    : { x: view.w / 2, y: view.h / 2, w: 0, h: 0 };

  let best: { score: number; layout: TourLayout } | null = null;
  for (const { name, cost } of ARRANGEMENTS) {
    const g = group(name, card, inti);
    const maxX = view.w - g.w - MARGIN;
    const maxY = view.h - g.h - MARGIN;
    const centerX = (view.w - g.w) / 2;
    const centerY = (view.h - g.h) / 2;
    const xs = target
      ? [
          target.x + target.w / 2 - g.w / 2,
          spot.x + spot.w + GAP,
          spot.x - GAP - g.w,
          MARGIN,
          maxX,
        ]
      : [centerX];
    const ys = target
      ? [
          spot.y + spot.h + GAP,
          spot.y - GAP - g.h,
          target.y + target.h / 2 - g.h / 2,
          MARGIN,
          maxY,
        ]
      : [centerY];
    // A group bigger than the screen can only be a last resort.
    const excess =
      Math.max(0, g.w + 2 * MARGIN - view.w) +
      Math.max(0, g.h + 2 * MARGIN - view.h);
    for (const rawX of xs)
      for (const rawY of ys) {
        const x = clamp(rawX, maxX);
        const y = clamp(rawY, maxY);
        const balloon = { x: x + g.card.x, y: y + g.card.y, ...card };
        const figure = {
          x: x + g.inti.x,
          y: y + g.inti.y,
          w: seen,
          h: inti.h,
        };
        let score = cost + excess * 10000;
        if (target) {
          score +=
            8 * area(balloon, target) +
            4 * area(figure, target) +
            40 * distance({ x, y, w: g.w, h: g.h }, spot);
        }
        for (const item of avoid)
          score += 10 * (area(balloon, item) + area(figure, item));
        if (!best || score < best.score)
          best = {
            score,
            layout: {
              spot,
              card: { x: balloon.x, y: balloon.y },
              inti: { x: figure.x - inset, y: figure.y },
              mirror: figure.x + seen / 2 > balloon.x + card.w / 2 + 1,
            },
          };
      }
  }
  return best!.layout;
}
