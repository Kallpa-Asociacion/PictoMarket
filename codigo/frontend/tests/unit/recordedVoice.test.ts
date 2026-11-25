import { describe, expect, it, vi } from 'vitest';
import { createSpeechController } from '../../src/audio/speech-controller.mjs';
import {
  RECORDED_VOICE_URI,
  createRecordedVoice,
} from '../../src/voice/recordedVoice';

const browserVoice = {
  name: 'Español local',
  lang: 'es-PE',
  voiceURI: 'local',
  localService: true,
};
class NativeUtterance {
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  voice: unknown = null;
  lang = '';
  volume = 1;
  rate = 1;
  constructor(public text: string) {}
}
class FakeAudio {
  src = '';
  volume = 1;
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  played: string[] = [];
  failWith: string | null = null;
  play = vi.fn(() => {
    if (this.failWith) {
      const error = new Error('play');
      error.name = this.failWith;
      return Promise.reject(error);
    }
    this.played.push(this.src);
    return Promise.resolve();
  });
  pause = vi.fn();
}
const CLIPS = { '¡muy bien!': 'a.mp3', 'busca: papa.': 'b.mp3' };

function setup(clips: Record<string, string> = CLIPS, voices = [browserVoice]) {
  const audio = new FakeAudio();
  const base = {
    getVoices: vi.fn(() => voices),
    speak: vi.fn(),
    cancel: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const voice = createRecordedVoice({
    base: base as unknown as SpeechSynthesis,
    Utterance: NativeUtterance as unknown as typeof SpeechSynthesisUtterance,
    clips,
    urlFor: (file) => `/audio/inti/${file}`,
    createAudio: () => audio as unknown as HTMLAudioElement,
  });
  const statuses: string[] = [];
  const controller = createSpeechController({
    synth: voice.synth,
    Utterance: voice.Utterance,
    settings: { voiceURI: RECORDED_VOICE_URI },
    onStatus: (status) => statuses.push(status.code),
  });
  return { audio, base, voice, controller, statuses };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('voz grabada de Inti', () => {
  it('sin grabaciones deja la voz del navegador como estaba', () => {
    const { voice, base } = setup({});
    expect(voice.synth).toBe(base);
    expect(voice.Utterance).toBe(NativeUtterance);
    expect(voice.recorded).toBe(false);
  });
  it('reproduce las oraciones grabadas en orden, sin usar el navegador', async () => {
    const { audio, base, controller, statuses } = setup();
    controller.update({ id: '1', text: '¡muy bien! busca: papa.' });
    controller.enable();
    await flush();
    expect(controller.snapshot().speaking).toBe(true);
    expect(audio.played).toEqual(['/audio/inti/a.mp3']);
    audio.onended!();
    await flush();
    expect(audio.played).toEqual(['/audio/inti/a.mp3', '/audio/inti/b.mp3']);
    audio.onended!();
    expect(controller.snapshot().speaking).toBe(false);
    expect(statuses).toContain('ended');
    expect(base.speak).not.toHaveBeenCalled();
  });
  it('respeta volumen y velocidad (la velocidad por defecto es natural)', async () => {
    const { audio, controller } = setup();
    controller.configure({ volume: 0.4, voiceURI: RECORDED_VOICE_URI });
    controller.update({ id: '1', text: '¡muy bien!' });
    controller.enable();
    await flush();
    expect(audio.volume).toBeCloseTo(0.4);
    expect(audio.playbackRate).toBeCloseTo(1);
  });
  it('si falta una grabación, todo el mensaje lo dice el navegador', () => {
    const { audio, base, controller } = setup();
    controller.update({ id: '1', text: '¡muy bien! frase sin grabar.' });
    controller.enable();
    expect(audio.play).not.toHaveBeenCalled();
    const sent = base.speak.mock.calls[0][0] as NativeUtterance;
    expect(sent).toBeInstanceOf(NativeUtterance);
    expect(sent.text).toBe('¡muy bien! frase sin grabar.');
    expect(sent.voice).toBe(browserVoice);
    sent.onstart!();
    expect(controller.snapshot().status.code).toBe('speaking');
    sent.onend!();
    expect(controller.snapshot().status.code).toBe('ended');
  });
  it('si un archivo falla, continúa con la voz del navegador desde esa oración', async () => {
    const { audio, base, controller } = setup();
    controller.update({ id: '1', text: '¡muy bien! busca: papa.' });
    controller.enable();
    await flush();
    audio.failWith = 'NotSupportedError';
    audio.onended!();
    await flush();
    expect((base.speak.mock.calls[0][0] as NativeUtterance).text).toBe(
      'busca: papa.',
    );
  });
  it('si el navegador bloquea el audio, lo informa como bloqueado', async () => {
    const { audio, controller } = setup();
    audio.failWith = 'NotAllowedError';
    controller.update({ id: '1', text: '¡muy bien!' });
    controller.enable();
    await flush();
    expect(controller.snapshot().status.code).toBe('blocked');
  });
  it('detener corta el audio y no sigue con la siguiente oración', async () => {
    const { audio, controller } = setup();
    controller.update({ id: '1', text: '¡muy bien! busca: papa.' });
    controller.enable();
    await flush();
    const resume = audio.onended!;
    controller.stop();
    expect(audio.pause).toHaveBeenCalled();
    resume();
    await flush();
    expect(audio.played).toHaveLength(1);
  });
  it('funciona en un dispositivo sin voces en español', async () => {
    const { audio, controller } = setup(CLIPS, []);
    controller.update({ id: '1', text: '¡muy bien!' });
    controller.enable();
    await flush();
    expect(audio.played).toHaveLength(1);
  });
  it('si se elige una voz del navegador, no usa las grabaciones', () => {
    const { audio, base, controller } = setup();
    controller.configure({ voiceURI: 'local' });
    controller.update({ id: '1', text: '¡muy bien!' });
    controller.enable();
    expect(base.speak).toHaveBeenCalledTimes(1);
    expect(audio.play).not.toHaveBeenCalled();
  });
});
