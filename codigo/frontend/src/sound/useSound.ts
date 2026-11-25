import { useEffect, useRef, useState } from 'react';
import { createSoundEngine, type EffectName, type SoundEngine } from './engine';
import type { TrackId } from './tracks';

export const SOUND_KEY = 'pictomarket.sound';

export interface SoundSettings {
  music: boolean;
  effects: boolean;
  volume: number;
}
// Low default volume: background music must never compete with the activity.
const DEFAULTS: SoundSettings = { music: true, effects: true, volume: 0.35 };

function readSettings(): SoundSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SOUND_KEY) ?? '{}');
    return {
      music: typeof saved.music === 'boolean' ? saved.music : DEFAULTS.music,
      effects:
        typeof saved.effects === 'boolean' ? saved.effects : DEFAULTS.effects,
      volume: typeof saved.volume === 'number' ? saved.volume : DEFAULTS.volume,
    };
  } catch {
    return DEFAULTS;
  }
}

function audioFactory(): (() => AudioContext) | undefined {
  const Context =
    typeof window === 'undefined' ? undefined : window.AudioContext;
  return Context ? () => new Context() : undefined;
}

/** `ducked` lowers the music while the voice is speaking. */
export function useSound(track: TrackId, ducked: boolean) {
  const [supported] = useState(() => Boolean(audioFactory()));
  const [settings, setSettings] = useState(readSettings);
  const [unlocked, setUnlocked] = useState(false);
  const engine = useRef<SoundEngine | null>(null);
  const latest = useRef({ settings, track, ducked });
  latest.current = { settings, track, ducked };

  useEffect(() => {
    const runtime = createSoundEngine(audioFactory());
    engine.current = runtime;
    const current = latest.current;
    runtime.setMusic(current.settings.music);
    runtime.setEffects(current.settings.effects);
    runtime.setVolume(current.settings.volume);
    runtime.setDucked(current.ducked);
    runtime.setHidden(document.hidden);
    runtime.play(current.track);

    // Browsers only allow audio after a gesture: the first tap or key starts
    // it. The music button handles its own gesture.
    const onGesture = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-sound-toggle]')) return;
      if (runtime.unlock()) setUnlocked(true);
    };
    const onVisibility = () => runtime.setHidden(document.hidden);
    window.addEventListener('click', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('click', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      document.removeEventListener('visibilitychange', onVisibility);
      runtime.destroy();
      engine.current = null;
    };
  }, []);

  useEffect(() => engine.current?.play(track), [track]);
  useEffect(() => engine.current?.setDucked(ducked), [ducked]);

  function configure(change: Partial<SoundSettings>) {
    const next = { ...latest.current.settings, ...change };
    latest.current.settings = next;
    setSettings(next);
    engine.current?.setMusic(next.music);
    engine.current?.setEffects(next.effects);
    engine.current?.setVolume(next.volume);
    try {
      window.localStorage.setItem(SOUND_KEY, JSON.stringify(next));
    } catch {
      // Storage can be blocked: the choice still applies to this visit.
    }
  }

  const playing = unlocked && settings.music;
  return {
    supported,
    settings,
    track,
    playing,
    configure,
    /** The music button: starts it if silent, mutes it if playing. */
    toggle() {
      configure({ music: !playing });
      if (engine.current?.unlock()) setUnlocked(true);
    },
    effect: (name: EffectName) => engine.current?.effect(name),
  };
}
export type SoundSupport = ReturnType<typeof useSound>;
