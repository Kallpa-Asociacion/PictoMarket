import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { INTRO_STEPS } from '../content/intro';
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

// Where the spotlight and Inti go for a target rect (viewport coordinates).
function place(target: DOMRect | null, width: number, height: number): Layout {
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
  return { spot, card: { x, y } };
}

export function GameTour({
  stepIndex,
  setStepIndex,
  finish,
  speech,
}: {
  stepIndex: number;
  setStepIndex: (index: number) => void;
  finish: () => void;
  speech: SpeechSupport;
}) {
  const step = INTRO_STEPS[stepIndex];
  const last = stepIndex === INTRO_STEPS.length - 1;
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const latest = useRef({ stepIndex, setStepIndex, finish });
  latest.current = { stepIndex, setStepIndex, finish };

  const measure = useCallback(() => {
    const el = step.target ? document.querySelector(step.target) : null;
    const rect = el ? el.getBoundingClientRect() : null;
    const box = card.current?.getBoundingClientRect();
    setLayout(place(rect, box?.width ?? 360, box?.height ?? 200));
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
        stepIndex: index,
        setStepIndex: go,
        finish: done,
      } = latest.current;
      if (event.key === 'ArrowRight') {
        if (index < INTRO_STEPS.length - 1) go(index + 1);
      } else if (event.key === 'ArrowLeft') {
        if (index > 0) go(index - 1);
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
          <ol
            className="tour-progress"
            aria-label={`Paso ${stepIndex + 1} de ${INTRO_STEPS.length}`}
          >
            {INTRO_STEPS.map((item, index) => (
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
          <h2 id="tour-heading" ref={heading} tabIndex={-1}>
            {step.title}
          </h2>
          <p className="tour-text" role="status" aria-live="polite">
            {step.text}
          </p>
          <div className="tour-controls">
            <button
              type="button"
              className="soft-button tour-button"
              onClick={() => setStepIndex(stepIndex - 1)}
              disabled={stepIndex === 0}
            >
              <ChevronLeft aria-hidden="true" />
              Atrás
            </button>
            <button
              type="button"
              className="primary-button tour-button tour-next"
              onClick={() => (last ? finish() : setStepIndex(stepIndex + 1))}
            >
              {last ? '¡A comprar!' : 'Siguiente'}
              <ChevronRight aria-hidden="true" />
            </button>
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
