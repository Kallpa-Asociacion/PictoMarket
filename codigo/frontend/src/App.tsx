import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { MarketStall } from './components/MarketStall';
import { ShoppingPanels } from './components/ShoppingPanels';
import { TherapistPanel } from './components/TherapistPanel';
import { VoiceControls } from './components/VoiceControls';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useGame } from './hooks/useGame';
import { useSpeech } from './hooks/useSpeech';

export default function App() {
  const { state, challenge, choose, reset } = useGame();
  const speech = useSpeech(state.mensaje);
  const [therapistOpen, setTherapistOpen] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (started) {
      document.getElementById('mercado')?.focus();
      window.scrollTo(0, 0);
    }
  }, [started]);
  function start() {
    // La bienvenida y la configuración no cuentan como tiempo de compra.
    reset();
    setStarted(true);
  }
  return (
    <>
      <a className="skip-link" href={started ? '#mercado' : '#bienvenida'}>
        {started ? 'Ir a los productos' : 'Ir a la bienvenida'}
      </a>
      {started ? (
        <div className="market-app">
          <Header challenge={challenge} />
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
          start={start}
          openTherapist={() => setTherapistOpen(true)}
        />
      )}
      <TherapistPanel
        open={therapistOpen}
        close={() => setTherapistOpen(false)}
        state={state}
        reset={reset}
      />
    </>
  );
}
