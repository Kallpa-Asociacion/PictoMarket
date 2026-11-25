import { useEffect, useRef, useState } from 'react';
import {
  createSpeechController,
  spanishVoices,
  type SpeechController,
  type SpeechSettings,
  type SpeechSnapshot,
} from '../audio/speech-controller.mjs';
import { publicAsset } from '../data/market';
import type { Message } from '../domain/game';
import voiceManifest from '../voice/manifest.json';
import {
  RECORDED_VOICE_URI,
  createRecordedVoice,
} from '../voice/recordedVoice';

const emptySnapshot: SpeechSnapshot = {
  supported: false,
  settings: { enabled: false, volume: 0.8, rate: 0.9, voiceURI: '' },
  status: { code: 'disabled', message_id: null },
  speaking: false,
  attemptedId: null,
};
export function useSpeech(message: Message) {
  const controller = useRef<SpeechController | null>(null);
  const preferences = useRef<Partial<SpeechSettings>>({});
  const latestMessage = useRef(message);
  latestMessage.current = message;
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    // Inti's recordings when they exist; otherwise the browser voice.
    const { recorded, synth, Utterance } = createRecordedVoice({
      base: window.speechSynthesis,
      Utterance: window.SpeechSynthesisUtterance,
      clips: voiceManifest.clips,
      urlFor: (file) => publicAsset(`audio/inti/${file}`),
    });
    const runtime = createSpeechController({
      synth,
      Utterance,
      settings: {
        ...(recorded ? { voiceURI: RECORDED_VOICE_URI } : {}),
        ...preferences.current,
      },
      isVisible: () => !document.hidden,
      onStatus: () => setSnapshot(runtime.snapshot()),
    });
    controller.current = runtime;
    runtime.update({
      id: latestMessage.current.id,
      text: latestMessage.current.texto_voz,
    });
    setSnapshot(runtime.snapshot());
    const refreshVoices = () => setVoices(spanishVoices(synth));
    const onVisibility = () => {
      if (document.hidden) runtime.stop();
    };
    const onPageHide = () => runtime.stop();
    refreshVoices();
    synth?.addEventListener('voiceschanged', refreshVoices);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      preferences.current = runtime.snapshot().settings;
      runtime.destroy();
      controller.current = null;
      synth?.removeEventListener('voiceschanged', refreshVoices);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    controller.current?.update({ id: message.id, text: message.texto_voz });
    if (controller.current) setSnapshot(controller.current.snapshot());
  }, [message.id, message.texto_voz]);

  function toggle() {
    const runtime = controller.current;
    if (!runtime) return;
    if (runtime.snapshot().settings.enabled) runtime.disable();
    else runtime.enable(); // En el gesto del clic, no en un efecto con autoplay.
    setSnapshot(runtime.snapshot());
  }
  function configure(settings: Partial<SpeechSettings>) {
    controller.current?.configure(settings);
    if (controller.current) setSnapshot(controller.current.snapshot());
  }
  return {
    snapshot,
    voices,
    toggle,
    configure,
    repeat: () => controller.current?.repeat(),
    stop: () => controller.current?.stop(),
  };
}
export type SpeechSupport = ReturnType<typeof useSpeech>;
