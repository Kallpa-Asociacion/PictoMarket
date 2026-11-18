import { useState } from 'react';
import { pictogramUrl } from '../data/market';
import type { GameState, MarketData } from '../domain/game';
import { pictoSentence, type SentenceItem } from '../domain/pictoSentence';

function SentenceImage({ item }: { item: SentenceItem }) {
  const [failed, setFailed] = useState(false);
  if (item.kind === 'category')
    return <span className="picto-icon">{item.icon}</span>;
  // The caption keeps the meaning when the image cannot load.
  if (failed || item.id === undefined) return <span className="picto-icon" />;
  return (
    <img
      src={pictogramUrl(item.id)}
      alt=""
      draggable="false"
      onError={() => setFailed(true)}
    />
  );
}

// Decorative reinforcement: the status text next to it is the accessible message.
export function PictoSentence({
  data,
  state,
}: {
  data: MarketData;
  state: GameState;
}) {
  const items = pictoSentence(data, state);
  if (!items.length) return null;
  return (
    <div className="picto-sentence" aria-hidden="true">
      {items.map((item, index) => (
        <span
          className="picto-part"
          key={`${item.kind}-${item.label}-${index}`}
        >
          {index > 0 && <span className="picto-plus">+</span>}
          <span className={`picto-item ${item.kind}`}>
            <SentenceImage item={item} />
            <span className="picto-caption">{item.label}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
