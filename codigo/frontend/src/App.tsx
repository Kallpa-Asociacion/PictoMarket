import { useEffect, useMemo, useRef, useState } from 'react';
import { GuideMascot } from './components/GuideMascot';
import { Header } from './components/Header';
import { GameTour } from './components/GameTour';
import { LeaveDialog } from './components/LeaveDialog';
import { MarketStall } from './components/MarketStall';
import { ShoppingPanels } from './components/ShoppingPanels';
import { TherapistPanel } from './components/TherapistPanel';
import { VoiceControls } from './components/VoiceControls';
import { WelcomeScreen } from './components/WelcomeScreen';
import { INTRO_STEPS } from './content/intro';
import { createMessage } from './domain/game';
import { GUIDE_NAME, guideLineFromGame, type GuideLine } from './domain/guide';
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

type Screen = 'home' | 'game';

const SKIP_LINKS: Record<Screen, { href: string; label: string }> = {
  home: { href: '#bienvenida', label: 'Ir a la bienvenida' },
  game: { href: '#mercado', label: 'Ir a los productos' },
};
const IDLE_TEXT = '¿Te ayudo? Toca 🔊 para escuchar.';

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
  const freshTour = useRef(false);
  const [therapistOpen, setTherapistOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  // A single active message drives the voice, whatever screen is showing.
  const homeMessage = useMemo(
    () =>
      createMessage(
        'inicio',
        `¡Hola! Soy ${GUIDE_NAME}. Toca EMPEZAR para jugar.`,
        'home-welcome',
      ),
    [],
  );
  const tourData = INTRO_STEPS[tourStep ?? 0];
  const tourMessage = useMemo(
    () => createMessage('inicio', tourData.text, `intro-${tourData.id}`),
    [tourData],
  );
  const activeMessage =
    screen === 'home'
      ? homeMessage
      : tourStep !== null
        ? tourMessage
        : state.mensaje;
  const speech = useSpeech(activeMessage);

  const idle = useIdleNudge(
    screen === 'game' && tourStep === null && state.items_restantes.length > 0,
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
    if (freshTour.current) {
      // Tour time must not count as shopping time.
      freshTour.current = false;
      reset();
    }
    document.getElementById('mercado')?.focus({ preventScroll: true });
  }
  function replayTour() {
    setTherapistOpen(false);
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
        <div className="market-app" inert={tourStep !== null}>
          <Header
            challenge={challenge}
            goHome={goHome}
            showGuide={replayTour}
          />
          {tourStep === null && <GuideMascot line={gameLine} />}
          <main className="market-layout">
            <MarketStall
              state={state}
              choose={choose}
              reset={reset}
              speech={speech}
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
          start={begin}
          openTherapist={() => setTherapistOpen(true)}
          speech={speech}
          line={{
            id: homeMessage.id,
            mood: 'greet',
            text: `¡Hola! Soy ${GUIDE_NAME}. Toca EMPEZAR para jugar.`,
          }}
        />
      )}
      {screen === 'game' && tourStep !== null && (
        <GameTour
          stepIndex={tourStep}
          setStepIndex={setTourStep}
          finish={finishTour}
          speech={speech}
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
      />
    </>
  );
}
