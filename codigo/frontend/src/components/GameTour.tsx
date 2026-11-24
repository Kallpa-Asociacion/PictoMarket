import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import type { IntroStep } from '../content/intro';
import { publicAsset } from '../data/market';
import { MOOD_BADGE } from '../domain/guide';
import type { SpeechSupport } from '../hooks/useSpeech';
import './tour.css';

const GAP = 16;
const MARGIN = 12;
const PAD = 10;

interface Layout {
  spot: { x: number; y: number; w: number; h: number };
  card: { x: number; y: number };
}

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: DOMRect) =>
  Math.max(0, Math.min(a.x + a.w, b.right) - Math.max(a.x, b.left)) *
  Math.max(0, Math.min(a.y + a.h, b.bottom) - Math.max(a.y, b.top));

// Where the spotlight and Inti go for a target rect (viewport coordinates).
// `avoid`: rects Inti should not cover (e.g. the products of the demo).
function place(
  target: DOMRect | null,
  width: number,
  height: number,
  avoid: DOMRect[] = [],
): Layout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) =>
    Math.min(Math.max(MARGIN, x), Math.max(MARGIN, vw - width - MARGIN));
  const clampY = (y: number) =>
    Math.min(Math.max(MARGIN, y), Math.max(MARGIN, vh - height - MARGIN));
  if (!target)
    return {
      spot: { x: vw / 2, y: vh / 2, w: 0, h: 0 },
      card: { x: clampX((vw - width) / 2), y: clampY((vh - height) / 2) },
    };
  const spot = {
    x: target.left - PAD,
    y: target.top - PAD,
    w: target.width + PAD * 2,
    h: target.height + PAD * 2,
  };
  const x = clampX(target.left + target.width / 2 - width / 2);
  const below = spot.y + spot.h + GAP;
  const above = spot.y - GAP - height;
  let y: number;
  if (below + height <= vh - MARGIN) y = below;
  else if (above >= MARGIN) y = above;
  else y = clampY(vh - height - MARGIN); // big target: sit at the bottom edge
  if (!avoid.length) return { spot, card: { x, y } };
  // Try the usual spot first, then the screen corners; keep the least covering.
  const options = [
    { x, y },
    ...[clampY(vh - height - MARGIN), MARGIN].flatMap((cy) =>
      [x, MARGIN, clampX(vw)].map((cx) => ({ x: cx, y: cy })),
    ),
  ];
  const covered = (card: { x: number; y: number }) =>
    avoid.reduce(
      (sum, rect) => sum + overlap({ ...card, w: width, h: height }, rect),
      0,
    );
  const card = options.reduce((best, option) =>
    covered(option) < covered(best) ? option : best,
  );
  return { spot, card };
}

export function GameTour({
  steps,
  stepIndex,
  setStepIndex,
  finish,
  speech,
  autoAdvanceMs,
  compact = false,
}: {
  steps: IntroStep[];
  stepIndex: number;
  setStepIndex: (index: number) => void;
  finish: () => void;
  speech: SpeechSupport;
  /** Pause before a step marked `auto` moves on by itself. */
  autoAdvanceMs?: number;
  /** Played sequence: no progress dots and no going back. */
  compact?: boolean;
}) {
  const step = steps[stepIndex];
  const last = stepIndex === steps.length - 1;
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const latest = useRef({ steps, stepIndex, setStepIndex, finish });
  latest.current = { steps, stepIndex, setStepIndex, finish };

  useEffect(() => {
    if (!autoAdvanceMs || !step.auto || last) return;
    const timer = window.setTimeout(
      () => latest.current.setStepIndex(stepIndex + 1),
      autoAdvanceMs,
    );
    return () => window.clearTimeout(timer);
  }, [autoAdvanceMs, step, last, stepIndex]);

  // Interactive step: the shelf can be touched, the rest of the game cannot.
  const interactive = step.touch !== undefined;
  useEffect(() => {
    if (!interactive) return;
    function block(event: Event) {
      const el = event.target as Element | null;
      if (el?.closest?.('.shelves, .tour-guide')) return;
      event.preventDefault();
      event.stopPropagation();
    }
    window.addEventListener('click', block, true);
    return () => window.removeEventListener('click', block, true);
  }, [interactive]);
  const latestFlags = useRef({ compact, interactive });
  latestFlags.current = { compact, interactive };

  const measure = useCallback(() => {
    const el = step.target ? document.querySelector(step.target) : null;
    const rect = el ? el.getBoundingClientRect() : null;
    const box = card.current?.getBoundingClientRect();
    const avoid = step.avoid
      ? [...document.querySelectorAll(step.avoid)].map((item) =>
          item.getBoundingClientRect(),
        )
      : [];
    setLayout(place(rect, box?.width ?? 360, box?.height ?? 200, avoid));
  }, [step]);

  // Bring the target into view before measuring, so the walk ends on screen.
  useLayoutEffect(() => {
    if (step.target)
      document
        .querySelector(step.target)
        ?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    measure();
  }, [step, measure]);
  // The card height depends on the text: measure again once it is rendered.
  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    heading.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(frame);
  }, [step, measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        document.querySelector('dialog[open]')
      )
        return;
      const {
        steps: all,
        stepIndex: index,
        setStepIndex: go,
        finish: done,
      } = latest.current;
      const flags = latestFlags.current;
      if (event.key === 'ArrowRight') {
        if (index < all.length - 1 && !flags.interactive) go(index + 1);
      } else if (event.key === 'ArrowLeft') {
        if (index > 0 && !flags.compact) go(index - 1);
      } else if (event.key === 'Escape') done();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const enabled = speech.snapshot.settings.enabled;
  const canSpeak = speech.snapshot.supported && speech.voices.length > 0;
  const spot = layout?.spot;
  return (
    <div
      className="tour"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-heading"
      data-step={step.id}
      // Interactive step: touches go through to the shelf below.
      style={interactive ? { pointerEvents: 'none' } : undefined}
    >
      <div
        className="tour-spot"
        aria-hidden="true"
        style={
          spot
            ? {
                transform: `translate(${spot.x}px, ${spot.y}px)`,
                width: spot.w,
                height: spot.h,
              }
            : { opacity: 0 }
        }
      />
      <div
        className="tour-guide"
        ref={card}
        style={{
          pointerEvents: 'auto',
          transform: layout
            ? `translate(${layout.card.x}px, ${layout.card.y}px)`
            : 'translate(-9999px, 0)',
        }}
      >
        <div
          key={step.id}
          className="guide-figure tour-figure"
          data-mood={step.mood}
        >
          <img
            className="guide-image"
            src={publicAsset('art/guide.webp')}
            alt=""
            draggable="false"
          />
          <span className="guide-badge" aria-hidden="true">
            {MOOD_BADGE[step.mood]}
          </span>
        </div>
        <div className="tour-bubble speech-bubble tail-left">
          {!compact && (
            <ol
              className="tour-progress"
              aria-label={`Paso ${stepIndex + 1} de ${steps.length}`}
            >
              {steps.map((item, index) => (
                <li
                  key={item.id}
                  className={
                    index === stepIndex
                      ? 'current'
                      : index < stepIndex
                        ? 'done'
                        : ''
                  }
                />
              ))}
            </ol>
          )}
          <h2 id="tour-heading" ref={heading} tabIndex={-1}>
            {step.title}
          </h2>
          <p className="tour-text" role="status" aria-live="polite">
            {step.text}
          </p>
          <div className="tour-controls">
            {!compact && (
              <button
                type="button"
                className="soft-button tour-button"
                onClick={() => setStepIndex(stepIndex - 1)}
                disabled={stepIndex === 0}
              >
                <ChevronLeft aria-hidden="true" />
                Atrás
              </button>
            )}
            {!interactive && (
              <button
                type="button"
                className="primary-button tour-button tour-next"
                onClick={() => (last ? finish() : setStepIndex(stepIndex + 1))}
              >
                {last ? '¡A comprar!' : 'Siguiente'}
                <ChevronRight aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="speech-speaker"
              aria-label={
                enabled ? 'Escuchar a Inti' : 'Activar voz y escuchar a Inti'
              }
              disabled={!canSpeak}
              onClick={enabled ? speech.repeat : speech.toggle}
            >
              <Volume2 aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="tour-skip" onClick={finish}>
            Saltar
          </button>
        </div>
      </div>
    </div>
  );
}
