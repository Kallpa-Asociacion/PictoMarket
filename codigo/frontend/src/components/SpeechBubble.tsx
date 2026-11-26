import { Volume2 } from 'lucide-react';
import type { GuideLine } from '../domain/guide';
import type { SpeechSupport } from '../hooks/useSpeech';
import './guide.css';

interface Props {
  line: GuideLine;
  tail: 'right' | 'top' | 'left' | 'bottom';
  /** Live bubbles are the screen-reader region; in-game ones are hidden. */
  live?: boolean;
  /** Replays the line; turns voice on first if it is off. */
  speech?: SpeechSupport;
  className?: string;
}

export function SpeechBubble({
  line,
  tail,
  live = false,
  speech,
  className = '',
}: Props) {
  const enabled = speech?.snapshot.settings.enabled ?? false;
  const canSpeak =
    !!speech && speech.snapshot.supported && speech.voices.length > 0;
  return (
    // The wrapper stays mounted so the live region announces text changes;
    // only the inner bubble remounts (key) to replay the entrance animation.
    <div
      className={`speech-wrap ${className}`}
      {...(live
        ? { role: 'status', 'aria-live': 'polite', 'aria-atomic': true }
        : { 'aria-hidden': true })}
    >
      <div
        key={line.id}
        className={`speech-bubble tail-${tail}`}
        data-mood={line.mood}
      >
        <p>{line.text}</p>
        {speech && (
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
        )}
      </div>
    </div>
  );
}
