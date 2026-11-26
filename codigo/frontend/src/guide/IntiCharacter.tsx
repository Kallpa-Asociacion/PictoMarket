import { publicAsset } from '../data/market';
import type { GuideMood } from '../domain/guide';
import { BASE_POSES, type Gesture } from './poses';
import { useIntiPose } from './useIntiPose';
import './inti.css';

/** Inti full figure: gestures, talks and blinks. Decorative for readers. */
export function IntiCharacter({
  lineId,
  text,
  mood,
  gesture,
  speaking,
  voiceOn,
}: {
  lineId: string;
  text: string;
  mood: GuideMood;
  gesture: Gesture;
  speaking: boolean;
  voiceOn: boolean;
}) {
  const pose = useIntiPose({ lineId, text, gesture, speaking, voiceOn });
  // The drawings stay mounted so switching between them never flickers.
  const frames = [...BASE_POSES, gesture];
  return (
    // The key restarts the entrance movement of each new line.
    <div
      key={lineId}
      className="guide-figure inti-figure"
      data-mood={mood}
      data-gesture={gesture}
      data-pose={pose}
    >
      <div className="inti-breath">
        {frames.map((name) => (
          <img
            key={name}
            className={`inti-frame ${name === pose ? 'is-active' : ''}`}
            src={publicAsset(`art/inti/${name}.webp`)}
            alt=""
            draggable="false"
          />
        ))}
      </div>
    </div>
  );
}
