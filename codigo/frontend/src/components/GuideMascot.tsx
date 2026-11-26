import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GUIDE_NAME, type GuideLine } from '../domain/guide';
import { IntiCharacter } from '../guide/IntiCharacter';
import { poseFor } from '../guide/poses';
import { SpeechBubble } from './SpeechBubble';

const AUTO_HIDE_MS = 6000;
// On phones Inti steps back sooner so more products show.
const SETTLE_MS = 3500;

// Smallest height that is still comfortable to look at.
const MIN_HEIGHT = 180;
const BUBBLE_FALLBACK = 70;

// Height left under the shopping list when it sits beside the products, so Inti
// and his balloon never hide it. Undefined on phones (the list goes below).
function useRoomUnderList(
  lineId: string,
  guide: React.RefObject<HTMLElement | null>,
) {
  const [room, setRoom] = useState<number>();
  useLayoutEffect(() => {
    function measure() {
      const list = document.querySelector('.list-panel');
      const rect = list?.getBoundingClientRect();
      if (!rect?.width || rect.left < window.innerWidth / 2) {
        setRoom(undefined);
        return;
      }
      const bubble =
        guide.current?.querySelector<HTMLElement>('.speech-wrap')
          ?.offsetHeight || BUBBLE_FALLBACK;
      // Position at the top of the page: scrolling must not resize him.
      const bottom = rect.bottom + window.scrollY;
      setRoom(Math.max(MIN_HEIGHT, window.innerHeight - bottom - bubble - 12));
    }
    measure();
    window.addEventListener('resize', measure);
    const list = document.querySelector('.list-panel');
    const observer =
      list && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : null;
    if (list) observer?.observe(list);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [lineId, guide]);
  return room;
}

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
  const guide = useRef<HTMLElement>(null);
  const room = useRoomUnderList(line.id, guide);
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
      ref={guide}
      style={
        room === undefined
          ? undefined
          : ({ '--inti-room': `${room}px` } as React.CSSProperties)
      }
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
