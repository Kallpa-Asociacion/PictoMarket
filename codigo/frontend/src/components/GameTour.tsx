import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import type { IntroStep } from '../content/intro';
import { IntiCharacter } from '../guide/IntiCharacter';
import { poseFor } from '../guide/poses';
import { placeTour, type TourLayout } from '../guide/tourLayout';
import type { SpeechSupport } from '../hooks/useSpeech';
import './tour.css';

// On phones the explained element goes to the top, leaving room below for the
// balloon and Inti.
const PHONE_WIDTH = 720;
const box = (rect: DOMRect) => ({
  x: rect.left,
  y: rect.top,
  w: rect.width,
  h: rect.height,
});

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
  const inti = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [layout, setLayout] = useState<TourLayout | null>(null);
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
    const avoid = step.avoid
      ? [...document.querySelectorAll(step.avoid)].map((item) =>
          box(item.getBoundingClientRect()),
        )
      : [];
    // Layout size: unaffected by the walking transform.
    const size = (node: HTMLElement | null, w: number, h: number) => ({
      w: node?.offsetWidth || w,
      h: node?.offsetHeight || h,
    });
    setLayout(
      placeTour({
        target: el ? box(el.getBoundingClientRect()) : null,
        card: size(card.current, 360, 200),
        inti: size(inti.current, 300, 244),
        view: { w: window.innerWidth, h: window.innerHeight },
        avoid,
      }),
    );
  }, [step]);

  // Bring the target into view before measuring, so the walk ends on screen.
  useLayoutEffect(() => {
    if (step.target)
      document.querySelector(step.target)?.scrollIntoView?.({
        block: window.innerWidth <= PHONE_WIDTH ? 'start' : 'center',
        inline: 'nearest',
      });
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
        className={`tour-inti ${layout?.mirror ? 'side-right' : 'side-left'}`}
        ref={inti}
        aria-hidden="true"
        style={
          layout
            ? { transform: `translate(${layout.inti.x}px, ${layout.inti.y}px)` }
            : { opacity: 0 }
        }
      >
        <IntiCharacter
          lineId={step.id}
          text={step.text}
          mood={step.mood}
          gesture={poseFor(step.mood, {
            pointing: Boolean(step.target),
            complete: step.id === 'focus-ready',
          })}
          speaking={speech.snapshot.speaking}
          voiceOn={enabled}
        />
      </div>
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
        <div className="tour-bubble speech-bubble">
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
