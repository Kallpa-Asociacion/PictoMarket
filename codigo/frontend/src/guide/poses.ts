// Inti's drawings (public/art/inti). All share the same canvas and alignment,
// so swapping them does not make the character jump.

import type { GuideMood } from '../domain/guide';

/** Same body and head; only the face changes: used to talk and blink. */
export const BASE_POSES = [
  'reposo',
  'habla-media',
  'habla-abierta',
  'parpadeo',
] as const;
export const GESTURES = [
  'saludo',
  'senala',
  'piensa',
  'celebra',
  'animo',
  'pulgar',
  'sorpresa',
] as const;
export const POSES = [...BASE_POSES, ...GESTURES];
export type Pose = (typeof POSES)[number];
export type Gesture = (typeof GESTURES)[number];

/** How long the gesture is shown before Inti starts talking. */
export const GESTURE_MS = 1200;

// A mistake is never answered with an angry face (errorless learning).
const BY_MOOD: Record<GuideMood, Gesture> = {
  greet: 'saludo',
  explain: 'sorpresa',
  celebrate: 'pulgar',
  encourage: 'animo',
  point: 'senala',
  think: 'piensa',
};

export function poseFor(
  mood: GuideMood,
  { pointing = false, complete = false } = {},
): Gesture {
  if (complete) return 'celebra';
  if (mood === 'explain' && pointing) return 'senala';
  return BY_MOOD[mood];
}
