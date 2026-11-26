import { useEffect, useMemo, useRef, useState } from 'react';
import { GuideMascot } from './components/GuideMascot';
import { Header } from './components/Header';
import { GameTour } from './components/GameTour';
import { LeaveDialog } from './components/LeaveDialog';
import { MarketStall, type Demo } from './components/MarketStall';
import { ShoppingPanels } from './components/ShoppingPanels';
import { TherapistPanel } from './components/TherapistPanel';
import { VoiceControls } from './components/VoiceControls';
import { WelcomeScreen } from './components/WelcomeScreen';
import { INTRO_STEPS, focusSteps, type FocusPlan } from './content/intro';
import { DIALOGUE } from './domain/dialogue';
import { createMessage } from './domain/game';
import { guideLineFromGame, type GuideLine } from './domain/guide';
import { market } from './data/market';
import {
  createHelpPolicy,
  DEFAULT_POLICY,
  type PolicyId,
} from './domain/policy';
import { useGame } from './hooks/useGame';
import { useIdleNudge } from './hooks/useIdleNudge';
import { useIntroSeen } from './hooks/useIntroSeen';
import { useSpeech } from './hooks/useSpeech';
import type { TrackId } from './sound/tracks';
import { useSound } from './sound/useSound';

type Screen = 'home' | 'game';

const SKIP_LINKS: Record<Screen, { href: string; label: string }> = {
  home: { href: '#bienvenida', label: 'Ir a la bienvenida' },
  game: { href: '#mercado', label: 'Ir a los productos' },
};
const IDLE_TEXT = '¿Te ayudo? Toca 🔊 para escuchar.';
// Time on the list (and on the list item) before the spotlight moves on.
const FOCUS_ADVANCE_MS = 3000;

export default function App() {
  const [policyId, setPolicyId] = useState<PolicyId>(DEFAULT_POLICY);
  const helpPolicy = useMemo(
    () => createHelpPolicy(market, policyId),
    [policyId],
  );
  const { state, challenge, choose, reset } = useGame(helpPolicy);
  const { seen, markSeen } = useIntroSeen();
  const [screen, setScreen] = useState<Screen>('home');
  // Guided tour over the game screen; null when it is not running.
  const [tourStep, setTourStep] = useState<number | null>(null);
  // Right after the tour the first purchases are played with Inti.
  const [focusStep, setFocusStep] = useState<number | null>(null);
  // Products of that demo; fixed so they survive the purchases.
  const [focusPlan, setFocusPlan] = useState<FocusPlan | null>(null);
  // Product touched by mistake in the demo, taken off the shelf.
  const [wrongTouch, setWrongTouch] = useState<number | null>(null);
  // Changes on every focus move so Inti repeats a line seen before.
  const [focusVisit, setFocusVisit] = useState(0);
  const freshTour = useRef(false);
  const [therapistOpen, setTherapistOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  // A single active message drives the voice, whatever screen is showing.
  const homeMessage = useMemo(
    () => createMessage('inicio', DIALOGUE.home, 'home-welcome'),
    [],
  );
  const focusData = useMemo(
    () => (focusPlan === null ? [] : focusSteps(focusPlan)),
    [focusPlan],
  );
  const guiding = tourStep !== null || focusStep !== null;
  const tourData =
    focusStep !== null
      ? (focusData[focusStep] ?? INTRO_STEPS[0])
      : INTRO_STEPS[tourStep ?? 0];
  const tourMessage = useMemo(
    () =>
      createMessage(
        'inicio',
        tourData.text,
        `intro-${tourData.id}-${focusVisit}`,
      ),
    [tourData, focusVisit],
  );
  // Demo level: the hints of the game (green / amber) shown by Inti.
  const demoProducts: Demo | undefined = !guiding
    ? undefined
    : tourData.demo === 'list'
      ? { ids: state.items_restantes, tone: 'target' }
      : focusStep !== null
        ? {
            ids: tourData.hint?.ids ?? [],
            tone: tourData.hint?.tone ?? 'target',
            // From "voy quitando productos" on, the mistake is off the shelf.
            hidden:
              wrongTouch !== null &&
              focusStep >= focusData.findIndex((s) => s.id === 'focus-remove')
                ? [wrongTouch]
                : [],
          }
        : undefined;
  const touchable = focusStep !== null && tourData.touch !== undefined;
  const activeMessage =
    screen === 'home' ? homeMessage : guiding ? tourMessage : state.mensaje;
  const speech = useSpeech(activeMessage);
  // Each part of the app has its own music.
  const track: TrackId = therapistOpen
    ? 'therapist'
    : screen === 'home'
      ? 'home'
      : state.items_restantes.length === 0
        ? 'celebration'
        : 'game';
  const sound = useSound(track, speech.snapshot.speaking);
  const heardEvents = useRef(0);
  useEffect(() => {
    const events = state.log_eventos;
    // Only new events make a sound (a reset empties the log).
    if (events.length > heardEvents.current)
      sound.effect(events[events.length - 1].correcto ? 'success' : 'hint');
    heardEvents.current = events.length;
  }, [state.log_eventos]);

  const idle = useIdleNudge(
    screen === 'game' && !guiding && state.items_restantes.length > 0,
    state.mensaje.id,
  );
  const gameLine: GuideLine = idle
    ? {
        id: `idle-${state.mensaje.id}`,
        mood: 'think',
        text: IDLE_TEXT,
        autoHide: false,
      }
    : guideLineFromGame(state);
  // Move focus to the new screen; skip the very first render.
  const previous = useRef<Screen>('home');
  useEffect(() => {
    if (previous.current === screen) return;
    previous.current = screen;
    // preventScroll: the guide is fixed, so the page must stay at the top.
    const focus = (id: string) =>
      document.getElementById(id)?.focus({ preventScroll: true });
    if (screen === 'game') focus('mercado');
    else if (screen === 'home') focus('bienvenida');
    window.scrollTo(0, 0);
    // The intro focuses its own heading.
  }, [screen]);

  function begin() {
    // The welcome screen does not count as shopping time.
    reset();
    setScreen('game');
    if (!seen) {
      freshTour.current = true;
      setTourStep(0);
    }
  }
  function finishTour() {
    markSeen();
    setTourStep(null);
    // First query, played with Inti: list, item, product on the shelf.
    const [first, second] = state.items_restantes;
    if (first === undefined) return finishFocus();
    const named = (id: number) => ({ id, name: market.catalogo[id].nombre });
    setFocusPlan({
      first: named(first),
      second: second === undefined ? undefined : named(second),
      decoy: state.productos_visibles.find(
        (id) =>
          !state.items_restantes.includes(id) &&
          !state.items_en_carrito.includes(id),
      ),
    });
    setFocusStep(0);
    setFocusVisit((visit) => visit + 1);
  }
  function startClock() {
    if (!freshTour.current) return;
    // Tour time must not count as shopping time.
    freshTour.current = false;
    reset();
  }
  function goFocus(index: number) {
    // The first touch starts the shopping time.
    if (focusData[index]?.touch !== undefined) startClock();
    setFocusStep(index);
    setFocusVisit((visit) => visit + 1);
  }
  function finishFocus() {
    startClock();
    setFocusStep(null);
    setFocusPlan(null);
    setWrongTouch(null);
    document.getElementById('mercado')?.focus({ preventScroll: true });
  }
  // While Inti waits for a touch: the asked product moves the demo on (and
  // is bought for real when the step says so); a mistake in the demo is not
  // counted, Inti explains the amber hint instead; other touches are ignored.
  function chooseProductInGame(id: number) {
    if (!touchable || focusStep === null) return choose(id);
    if (id === tourData.touch) {
      if (tourData.buys) choose(id);
      else setWrongTouch(id);
      goFocus(focusStep + 1);
    } else if (tourData.onWrong) {
      setWrongTouch(id);
      goFocus(focusData.findIndex((step) => step.id === tourData.onWrong));
    } else goFocus(focusStep); // Inti says it again
  }
  function replayTour() {
    setTherapistOpen(false);
    setFocusStep(null);
    setFocusPlan(null);
    setWrongTouch(null);
    setTourStep(0);
  }
  function goHome() {
    if (state.items_en_carrito.length) setLeaveOpen(true);
    else setScreen('home');
  }

  const skip = SKIP_LINKS[screen];
  return (
    <>
      <a className="skip-link" href={skip.href}>
        {skip.label}
      </a>
      {screen === 'game' ? (
        <div className="market-app with-inti" inert={guiding && !touchable}>
          <Header
            challenge={challenge}
            goHome={goHome}
            showGuide={replayTour}
            sound={sound}
          />
          {!guiding && (
            <GuideMascot
              line={gameLine}
              speaking={speech.snapshot.speaking}
              // The idle nudge is only visual: the voice does not read it.
              voiceOn={speech.snapshot.settings.enabled && !idle}
              complete={state.items_restantes.length === 0}
            />
          )}
          <main className="market-layout">
            <MarketStall
              state={state}
              choose={chooseProductInGame}
              reset={reset}
              speech={speech}
              demo={demoProducts}
            />
            <ShoppingPanels
              state={state}
              challenge={challenge}
              openTherapist={() => setTherapistOpen(true)}
            />
          </main>
          <VoiceControls speech={speech} />
          <footer className="credits">
            Pictogramas: Sergio Palao ·{' '}
            <a href="https://arasaac.org" target="_blank" rel="noreferrer">
              ARASAAC
            </a>{' '}
            · Gobierno de Aragón · CC BY-NC-SA
          </footer>
        </div>
      ) : (
        <WelcomeScreen
          sound={sound}
          start={begin}
          openTherapist={() => setTherapistOpen(true)}
          speech={speech}
          line={{
            id: homeMessage.id,
            mood: 'greet',
            text: DIALOGUE.home,
          }}
        />
      )}
      {screen === 'game' && tourStep !== null && (
        <GameTour
          steps={INTRO_STEPS}
          stepIndex={tourStep}
          setStepIndex={setTourStep}
          finish={finishTour}
          speech={speech}
        />
      )}
      {screen === 'game' && focusStep !== null && focusData.length > 0 && (
        <GameTour
          key="focus"
          steps={focusData}
          stepIndex={focusStep}
          setStepIndex={goFocus}
          finish={finishFocus}
          speech={speech}
          autoAdvanceMs={FOCUS_ADVANCE_MS}
          compact
        />
      )}
      <LeaveDialog
        open={leaveOpen}
        stay={() => setLeaveOpen(false)}
        leave={() => {
          setLeaveOpen(false);
          setScreen('home');
        }}
      />
      <TherapistPanel
        open={therapistOpen}
        close={() => setTherapistOpen(false)}
        state={state}
        reset={reset}
        replayTour={replayTour}
        policy={policyId}
        setPolicy={setPolicyId}
        sound={sound}
      />
    </>
  );
}
