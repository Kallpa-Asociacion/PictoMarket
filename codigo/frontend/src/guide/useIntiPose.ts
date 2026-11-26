import { useEffect, useState } from 'react';
import { GESTURE_MS, type Gesture, type Pose } from './poses';

// Mouth shapes in an order that reads as speech.
const MOUTH: Pose[] = [
  'habla-media',
  'habla-abierta',
  'habla-media',
  'reposo',
  'habla-abierta',
  'habla-media',
  'habla-abierta',
  'reposo',
];
const MOUTH_MS = 130;
const BLINK_MS = 150;
// Without voice, talk for about as long as it takes to read the line.
const MS_PER_LETTER = 55;
const MAX_TALK_MS = 5000;

const reducedMotionQuery = () =>
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

interface Options {
  /** A new id replays the gesture. */
  lineId: string;
  text: string;
  gesture: Gesture;
  /** The voice is sounding right now. */
  speaking: boolean;
  voiceOn: boolean;
}

/** Which drawing to show: gesture, then talking, then resting and blinking. */
export function useIntiPose({
  lineId,
  text,
  gesture,
  speaking,
  voiceOn,
}: Options): Pose {
  const [reduced] = useState(() => reducedMotionQuery()?.matches ?? false);
  const [stage, setStage] = useState({
    lineId,
    gestureDone: false,
    readDone: false,
  });
  const [frame, setFrame] = useState(0);
  const [blinking, setBlinking] = useState(false);
  // A new line starts its own stage during render, so the gesture shows at once.
  const current =
    stage.lineId === lineId
      ? stage
      : { lineId, gestureDone: false, readDone: false };

  useEffect(() => {
    setStage({ lineId, gestureDone: false, readDone: false });
    const talkMs = Math.min(MAX_TALK_MS, text.length * MS_PER_LETTER);
    const gestureTimer = setTimeout(
      () => setStage((s) => ({ ...s, gestureDone: true })),
      GESTURE_MS,
    );
    const readTimer = setTimeout(
      () => setStage((s) => ({ ...s, readDone: true })),
      GESTURE_MS + talkMs,
    );
    return () => {
      clearTimeout(gestureTimer);
      clearTimeout(readTimer);
    };
  }, [lineId, text]);

  const talking =
    !reduced && current.gestureDone && (voiceOn ? speaking : !current.readDone);

  useEffect(() => {
    if (!talking) return;
    const timer = setInterval(() => setFrame((n) => n + 1), MOUTH_MS);
    return () => clearInterval(timer);
  }, [talking]);

  // The final celebration keeps celebrating instead of going back to rest.
  const resting =
    !reduced && current.gestureDone && !talking && gesture !== 'celebra';
  useEffect(() => {
    if (!resting) return;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(
        () => {
          setBlinking(true);
          timer = setTimeout(() => {
            setBlinking(false);
            wait();
          }, BLINK_MS);
        },
        2200 + Math.random() * 2600,
      );
    };
    wait();
    return () => {
      clearTimeout(timer);
      setBlinking(false);
    };
  }, [resting]);

  if (reduced || !current.gestureDone) return gesture;
  if (talking) return MOUTH[frame % MOUTH.length];
  if (gesture === 'celebra') return gesture;
  return blinking ? 'parpadeo' : 'reposo';
}
