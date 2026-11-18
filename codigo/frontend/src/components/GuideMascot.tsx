import { useEffect, useState } from 'react';
import { publicAsset } from '../data/market';
import { GUIDE_NAME, MOOD_BADGE, type GuideLine } from '../domain/guide';
import type { SpeechSupport } from '../hooks/useSpeech';
import { SpeechBubble } from './SpeechBubble';

const AUTO_HIDE_MS = 6000;

// Keeps `--topbar-height` in sync with the real top bar so the fixed guide
// never covers the logo, whatever the breakpoint.
function useTopbarHeight() {
  useEffect(() => {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    const apply = () =>
      document.documentElement.style.setProperty(
        '--topbar-height',
        `${Math.round(topbar.getBoundingClientRect().bottom + window.scrollY)}px`,
      );
    apply();
    window.addEventListener('resize', apply);
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(topbar);
    return () => {
      window.removeEventListener('resize', apply);
      observer?.disconnect();
    };
  }, []);
}

interface Props {
  line: GuideLine;
  speech?: SpeechSupport;
  /** True when the bubble is the screen-reader region (intro). */
  live?: boolean;
}

export function GuideMascot({ line, speech, live = false }: Props) {
  useTopbarHeight();
  // Success and greeting bubbles shrink to the portrait after a few seconds;
  // tapping the portrait brings the last bubble back.
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  const [replays, setReplays] = useState(0);
  useEffect(() => {
    if (!line.autoHide) return;
    const timer = setTimeout(() => setHiddenId(line.id), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [line.id, line.autoHide, replays]);
  const collapsed = hiddenId === line.id;
  return (
    <aside
      className={`guide-mascot guide-game`}
      aria-label={live ? `Guía ${GUIDE_NAME}` : undefined}
      {...(live ? {} : { 'aria-hidden': true })}
    >
      {!collapsed && (
        <SpeechBubble
          line={line}
          tail="right"
          live={live}
          speech={speech}
          className="guide-speech"
        />
      )}
      {/* Pointer-only affordance: the same text lives in the instruction board. */}
      <div
        className="guide-portrait-frame"
        onClick={() => {
          setHiddenId(null);
          setReplays((count) => count + 1);
        }}
      >
        <div key={line.id} className="guide-figure" data-mood={line.mood}>
          <img
            className="guide-image"
            src={publicAsset('art/guide.webp')}
            alt=""
            draggable="false"
          />
          <span className="guide-badge">{MOOD_BADGE[line.mood]}</span>
        </div>
      </div>
    </aside>
  );
}
