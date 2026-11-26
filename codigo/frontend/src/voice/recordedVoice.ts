// Inti's recorded voice. It offers the same interface as speechSynthesis, so
// the speech controller does not need to know where the sound comes from.
// With recordings, Inti is the ONLY voice: the browser voice is never used as a
// fallback, so two different voices are never heard. Nothing here calls any
// online service: the clips are recorded once with scripts/generate-voice.mjs.

import { splitSentences } from './sentences';

export const RECORDED_VOICE_URI = 'inti-recorded';
// The controller's default rate (0.9) plays the recordings at natural speed.
const NATURAL_RATE = 0.9;

const recordedVoice = {
  name: 'Inti (voz grabada)',
  lang: 'es-PE',
  voiceURI: RECORDED_VOICE_URI,
  localService: true,
  default: false,
} as SpeechSynthesisVoice;

class RecordedUtterance {
  voice: SpeechSynthesisVoice | null = null;
  lang = '';
  volume = 1;
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

interface Options {
  base?: SpeechSynthesis;
  Utterance?: typeof SpeechSynthesisUtterance;
  /** Sentence key -> audio file name. */
  clips: Record<string, string>;
  urlFor: (file: string) => string;
  createAudio?: () => HTMLAudioElement;
  /** Downloads a clip and returns a local address for it; null disables it. */
  preload?: ((url: string) => Promise<string>) | null;
}

const downloadClip =
  typeof fetch === 'function' && typeof URL.createObjectURL === 'function'
    ? async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return URL.createObjectURL(await response.blob());
      }
    : null;

export function createRecordedVoice({
  base,
  Utterance,
  clips,
  urlFor,
  createAudio = () => new Audio(),
  preload = downloadClip,
}: Options) {
  if (!Object.keys(clips).length || typeof Audio === 'undefined')
    return { recorded: false, synth: base, Utterance };

  // One element for every clip: once a gesture started it, phones allow the
  // following clips to play too.
  let audio: HTMLAudioElement | null = null;
  let turn = 0;

  // The first time Inti speaks, every clip is downloaded in the background so
  // a slow or lost connection cannot silence him in the middle of a game.
  const local = new Map<string, string>();
  let preloading = false;
  function preloadAll() {
    if (!preload || preloading) return;
    preloading = true;
    const pending = Object.values(clips);
    const worker = async () => {
      for (let file = pending.shift(); file; file = pending.shift()) {
        try {
          local.set(file, await preload(urlFor(file)));
        } catch {
          // It is still played from its normal address.
        }
      }
    };
    for (let i = 0; i < 4; i++) void worker();
  }

  function playClips(utterance: RecordedUtterance, files: string[]) {
    const current = ++turn;
    const player = (audio ??= createAudio());
    let started = false;
    const play = (index: number, retried = false) => {
      if (current !== turn) return;
      if (index >= files.length) {
        if (started) utterance.onend?.();
        else utterance.onerror?.({ error: 'synthesis-failed' });
        return;
      }
      let failed = false;
      // Retry a clip once from the network; then go on with the next one.
      const recover = () => {
        if (current !== turn || failed) return;
        failed = true;
        local.delete(files[index]);
        if (retried) play(index + 1);
        else play(index, true);
      };
      player.src = local.get(files[index]) ?? urlFor(files[index]);
      if (retried) player.load?.();
      player.volume = utterance.volume;
      player.playbackRate = utterance.rate / NATURAL_RATE;
      player.onended = () => play(index + 1);
      player.onerror = recover;
      Promise.resolve(player.play()).then(
        () => {
          if (current !== turn || started) return;
          started = true;
          utterance.onstart?.();
        },
        (error: Error) => {
          if (current !== turn) return;
          if (error.name === 'NotAllowedError')
            utterance.onerror?.({ error: 'not-allowed' });
          else recover();
        },
      );
    };
    play(0);
  }

  const synth = {
    getVoices: () => [recordedVoice],
    speak(value: SpeechSynthesisUtterance) {
      const utterance = value as unknown as RecordedUtterance;
      // A sentence without recording is skipped (it stays on screen).
      const files = splitSentences(utterance.text)
        .map((sentence) => clips[sentence])
        .filter(Boolean);
      playClips(utterance, files);
      preloadAll();
    },
    cancel() {
      turn++;
      audio?.pause();
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as SpeechSynthesis;

  return {
    recorded: true,
    synth,
    Utterance: RecordedUtterance as unknown as typeof SpeechSynthesisUtterance,
  };
}
