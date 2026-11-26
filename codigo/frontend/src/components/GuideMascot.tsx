import { useEffect, useState } from 'react';
import { GUIDE_NAME, type GuideLine } from '../domain/guide';
import { IntiCharacter } from '../guide/IntiCharacter';
import { poseFor } from '../guide/poses';
import { SpeechBubble } from './SpeechBubble';

const AUTO_HIDE_MS = 6000;
// On phones Inti steps back sooner so more products show.
const SETTLE_MS = 3500;

interface Props {
  line: GuideLine;
  /** The voice is sounding right now. */
  speaking?: boolean;
  /** The voice reads this line, so the mouth follows it. */
  voiceOn?: boolean;
  /** The shopping list is complete. */
  complete?: boolean;
}

export function GuideMascot({
  line,
  speaking = false,
  voiceOn = false,
  complete = false,
}: Props) {
  // Success and greeting balloons close after a while; tapping the peeking
  // Inti brings the last one back.
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  const [replays, setReplays] = useState(0);
  useEffect(() => {
    if (!line.autoHide || complete) return;
    const timer = setTimeout(() => setHiddenId(line.id), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [line.id, line.autoHide, complete, replays]);
  const collapsed = hiddenId === line.id;
  const [settledId, setSettledId] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettledId(line.id), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [line.id, replays]);
  const settled = settledId === line.id && !complete;
  return (
    // The same words are in the instruction board, which is the live region.
    <aside
      className={`guide-mascot guide-corner side-right ${collapsed ? 'is-peeking' : ''} ${settled ? 'is-settled' : ''}`}
      data-guide={GUIDE_NAME}
      aria-hidden="true"
    >
      {!collapsed && (
        <SpeechBubble line={line} tail="bottom" className="guide-speech" />
      )}
      <div
        className="guide-portrait-frame"
        onClick={() => {
          setHiddenId(null);
          setReplays((count) => count + 1);
        }}
      >
        <IntiCharacter
          lineId={line.id}
          text={line.text}
          mood={line.mood}
          gesture={poseFor(line.mood, { complete })}
          speaking={speaking}
          voiceOn={voiceOn}
        />
      </div>
    </aside>
  );
}
