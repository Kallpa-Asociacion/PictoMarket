import { ChevronRight, Heart, Leaf } from 'lucide-react';
import { publicAsset } from '../data/market';
import { Header } from './Header';
import './welcome.css';

export function WelcomeScreen({
  start,
  openTherapist,
}: {
  start: () => void;
  openTherapist: () => void;
}) {
  return (
    <div className="welcome-screen">
      <div className="welcome-shell">
        <Header />
        <main className="welcome-main" id="bienvenida" tabIndex={-1}>
          <div className="welcome-scene">
            <div className="welcome-chalkboard learn-board" aria-hidden="true">
              <span>
                ¡Aprende
                <br />
                mientras
                <br />
                juegas!
              </span>
              <Leaf />
            </div>
            <section
              className="welcome-stall"
              aria-labelledby="welcome-heading"
            >
              <img
                className="welcome-awning"
                src={publicAsset('art/welcome-awning.webp')}
                alt=""
              />
              <div className="welcome-post left-post" aria-hidden="true" />
              <div className="welcome-post right-post" aria-hidden="true" />
              <div className="welcome-lights" aria-hidden="true">
                {Array.from({ length: 7 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
              <div className="welcome-paper">
                <h1
                  id="welcome-heading"
                  aria-label="¡Bienvenidos a PictoMarket!"
                >
                  <span className="welcome-greeting">¡Bienvenidos a</span>
                  <span className="welcome-title">
                    PICTO<span>MARKET</span>
                    <b>!</b>
                  </span>
                </h1>
                <div className="welcome-illustration" aria-hidden="true">
                  <img
                    className="welcome-guide"
                    src={publicAsset('art/welcome-guide.webp')}
                    alt=""
                  />
                  <img
                    className="welcome-basket"
                    src={publicAsset('art/welcome-basket.svg')}
                    alt=""
                  />
                </div>
              </div>
              <div className="welcome-counter">
                <button className="start-button" onClick={start}>
                  EMPEZAR <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </section>
            <img
              className="welcome-crate left-crate"
              src={publicAsset('art/welcome-crate.svg')}
              alt=""
            />
            <img
              className="welcome-crate right-crate"
              src={publicAsset('art/welcome-crate.svg')}
              alt=""
            />
            <div
              className="welcome-chalkboard explore-board"
              aria-hidden="true"
            >
              <span>
                Explora
                <br />
                Compra
                <br />
                Aprende
              </span>
              <Heart />
            </div>
          </div>
        </main>
        <div className="welcome-footer">
          <button
            className="therapist-button welcome-therapist"
            onClick={openTherapist}
          >
            <span className="therapist-avatar" aria-hidden="true">
              👩🏻‍⚕️
            </span>
            <span>Panel del terapeuta</span>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
