import {
  CircleHelp,
  CookingPot,
  House,
  ShoppingCart,
  Sunrise,
} from 'lucide-react';
import { publicAsset } from '../data/market';
import { objectiveWords, type Challenge } from '../domain/game';

export function ObjectiveChips({
  challenge,
  decorative = false,
}: {
  challenge: Challenge;
  /** Hidden from assistive tech when it only illustrates (intro). */
  decorative?: boolean;
}) {
  const words = objectiveWords(challenge);
  return (
    <div
      className="objective"
      {...(decorative
        ? { 'aria-hidden': true }
        : { 'aria-label': `Objetivo: ${words.join(' ').toLowerCase()}` })}
    >
      {words.map((word, index) => {
        const Icon =
          index === 0
            ? ShoppingCart
            : index === 1
              ? House
              : word === 'DESAYUNO'
                ? Sunrise
                : CookingPot;
        return (
          <span
            className={`objective-chip ${index === 0 ? 'primary-chip' : ''}`}
            key={word}
          >
            <Icon aria-hidden="true" />
            {word}
          </span>
        );
      })}
    </div>
  );
}

export function Header({
  challenge,
  goHome,
  showGuide,
}: {
  challenge?: Challenge;
  goHome?: () => void;
  showGuide?: () => void;
}) {
  return (
    <header className="topbar">
      <a
        className="brand"
        href={challenge ? '#mercado' : '#bienvenida'}
        aria-label={
          challenge ? 'PictoMarket, ir al mercado' : 'PictoMarket, bienvenida'
        }
      >
        <span className="brand-cart">
          <ShoppingCart aria-hidden="true" />
          <span aria-hidden="true">🍎</span>
        </span>
        <span>
          PICTO<span className="brand-accent">MARKET</span>
        </span>
      </a>
      {goHome && (
        <button
          type="button"
          className="home-button"
          onClick={goHome}
          aria-label="Volver al inicio"
        >
          <House aria-hidden="true" />
          <span aria-hidden="true">Inicio</span>
        </button>
      )}
      {showGuide && (
        <button
          type="button"
          className="home-button guide-button"
          onClick={showGuide}
          aria-label="Ver la presentación de Inti"
        >
          <CircleHelp aria-hidden="true" />
          <span aria-hidden="true">Guía</span>
        </button>
      )}
      {challenge && <ObjectiveChips challenge={challenge} />}
      <img
        className="partner-logo"
        src={publicAsset('art/kallpa.webp')}
        alt="Kallpa Asociación"
      />
    </header>
  );
}
