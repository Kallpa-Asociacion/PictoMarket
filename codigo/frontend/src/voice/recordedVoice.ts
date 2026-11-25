// Inti's recorded voice. It offers the same interface as speechSynthesis, so
// the speech controller does not know whether a message is played from
// recordings or read by the browser. Nothing here calls any online service:
// the clips are recorded once with scripts/generate-voice.mjs.

import { spanishVoices } from '../audio/speech-controller.mjs';
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
}

export function createRecordedVoice({
  base,
  Utterance,
  clips,
  urlFor,
  createAudio = () => new Audio(),
}: Options) {
  if (!Object.keys(clips).length || typeof Audio === 'undefined')
    return { recorded: false, synth: base, Utterance };

  // One element for every clip: once a gesture started it, phones allow the
  // following clips to play too.
  let audio: HTMLAudioElement | null = null;
  let turn = 0;

  /** Reads `text` with a browser voice, reporting to the same utterance. */
  function readWithBrowser(
    utterance: RecordedUtterance,
    text: string,
    voice: SpeechSynthesisVoice | undefined,
  ) {
    if (!base || !Utterance || !voice) {
      utterance.onerror?.({ error: 'synthesis-failed' });
      return;
    }
    const native = new Utterance(text);
    native.voice = voice;
    native.lang = voice.lang;
    native.volume = utterance.volume;
    native.rate = utterance.rate;
    native.onstart = () => utterance.onstart?.();
    native.onend = () => utterance.onend?.();
    native.onerror = (event) => utterance.onerror?.({ error: event.error });
    base.speak(native);
  }

  function playClips(utterance: RecordedUtterance, sentences: string[]) {
    const current = ++turn;
    const player = (audio ??= createAudio());
    const fallbackFrom = (index: number) => {
      if (current !== turn) return;
      turn++;
      player.pause();
      readWithBrowser(
        utterance,
        sentences.slice(index).join(' '),
        base ? spanishVoices(base)[0] : undefined,
      );
    };
    const play = (index: number) => {
      if (current !== turn) return;
      if (index >= sentences.length) {
        utterance.onend?.();
        return;
      }
      player.src = urlFor(clips[sentences[index]]);
      player.volume = utterance.volume;
      player.playbackRate = utterance.rate / NATURAL_RATE;
      player.onended = () => play(index + 1);
      player.onerror = () => fallbackFrom(index);
      Promise.resolve(player.play()).then(
        () => {
          if (current === turn && index === 0) utterance.onstart?.();
        },
        (error: Error) => {
          if (current !== turn) return;
          if (error.name === 'NotAllowedError')
            utterance.onerror?.({ error: 'not-allowed' });
          else fallbackFrom(index);
        },
      );
    };
    play(0);
  }

  const synth = {
    getVoices: () => [recordedVoice, ...(base?.getVoices() ?? [])],
    speak(value: SpeechSynthesisUtterance) {
      const utterance = value as unknown as RecordedUtterance;
      const chosen = utterance.voice;
      if (chosen && chosen.voiceURI !== RECORDED_VOICE_URI) {
        readWithBrowser(utterance, utterance.text, chosen);
        return;
      }
      const sentences = splitSentences(utterance.text);
      if (sentences.every((sentence) => sentence in clips))
        playClips(utterance, sentences);
      else
        readWithBrowser(
          utterance,
          utterance.text,
          base ? spanishVoices(base)[0] : undefined,
        );
    },
    cancel() {
      turn++;
      audio?.pause();
      base?.cancel();
    },
    addEventListener: (
      ...args: Parameters<SpeechSynthesis['addEventListener']>
    ) => base?.addEventListener(...args),
    removeEventListener: (
      ...args: Parameters<SpeechSynthesis['removeEventListener']>
    ) => base?.removeEventListener(...args),
  } as unknown as SpeechSynthesis;

  return {
    recorded: true,
    synth,
    Utterance: RecordedUtterance as unknown as typeof SpeechSynthesisUtterance,
  };
}
