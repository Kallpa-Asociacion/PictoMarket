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
  voice: unknown = null;
  constructor(public text: string) {}
}
class FakeAudio {
  src = '';
  volume = 1;
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  played: string[] = [];
  /** File names that fail, with the number of times they still will. */
  failing: Record<string, number> = {};
  blocked = false;
  play = vi.fn(() => {
    const file = this.src.split('/').pop()!;
    const error = new Error('play');
    if (this.blocked) {
      error.name = 'NotAllowedError';
      return Promise.reject(error);
    }
    if (this.failing[file] > 0) {
      this.failing[file]--;
      error.name = 'NotSupportedError';
      return Promise.reject(error);
    }
    this.played.push(this.src);
    return Promise.resolve();
  });
  load = vi.fn();
  pause = vi.fn();
}
const CLIPS = { '¡muy bien!': 'a.mp3', 'busca: papa.': 'b.mp3' };

function setup(
  clips: Record<string, string> = CLIPS,
  options: { preload?: (url: string) => Promise<string> } = {},
) {
  const audio = new FakeAudio();
  const base = {
    getVoices: vi.fn(() => [browserVoice]),
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
    preload: options.preload ?? null,
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
async function say(context: ReturnType<typeof setup>, text: string, id = '1') {
  context.controller.update({ id, text });
  context.controller.enable();
  await flush();
}
/** Lets every queued clip finish. */
async function finish(audio: FakeAudio) {
  for (let i = 0; i < 6; i++) {
    audio.onended?.();
    await flush();
  }
}

describe('voz grabada de Inti', () => {
  it('sin grabaciones deja la voz del navegador como estaba', () => {
    const { voice, base } = setup({});
    expect(voice.synth).toBe(base);
    expect(voice.Utterance).toBe(NativeUtterance);
    expect(voice.recorded).toBe(false);
  });
  it('con grabaciones solo ofrece la voz de Inti', () => {
    const { voice } = setup();
    expect(voice.synth!.getVoices().map((v) => v.voiceURI)).toEqual([
      RECORDED_VOICE_URI,
    ]);
  });
  it('reproduce las oraciones grabadas en orden', async () => {
    const context = setup();
    const { audio, controller, statuses } = context;
    await say(context, '¡muy bien! busca: papa.');
    expect(controller.snapshot().speaking).toBe(true);
    await finish(audio);
    expect(audio.played).toEqual(['/audio/inti/a.mp3', '/audio/inti/b.mp3']);
    expect(controller.snapshot().speaking).toBe(false);
    expect(statuses).toContain('ended');
  });
  it('respeta volumen y velocidad (la velocidad por defecto es natural)', async () => {
    const context = setup();
    context.controller.configure({
      volume: 0.4,
      voiceURI: RECORDED_VOICE_URI,
    });
    await say(context, '¡muy bien!');
    expect(context.audio.volume).toBeCloseTo(0.4);
    expect(context.audio.playbackRate).toBeCloseTo(1);
  });

  describe('la voz del navegador no suena nunca', () => {
    it('una frase sin grabar se salta y se oyen las demás', async () => {
      const context = setup();
      await say(context, '¡muy bien! frase sin grabar. busca: papa.');
      await finish(context.audio);
      expect(context.audio.played).toEqual([
        '/audio/inti/a.mp3',
        '/audio/inti/b.mp3',
      ]);
      expect(context.base.speak).not.toHaveBeenCalled();
    });
    it('un audio que falla se reintenta una vez', async () => {
      const context = setup();
      context.audio.failing['a.mp3'] = 1;
      await say(context, '¡muy bien! busca: papa.');
      await finish(context.audio);
      expect(context.audio.played).toEqual([
        '/audio/inti/a.mp3',
        '/audio/inti/b.mp3',
      ]);
      expect(context.base.speak).not.toHaveBeenCalled();
    });
    it('si sigue fallando, continúa con la siguiente frase', async () => {
      const context = setup();
      context.audio.failing['a.mp3'] = 9;
      await say(context, '¡muy bien! busca: papa.');
      await finish(context.audio);
      expect(context.audio.played).toEqual(['/audio/inti/b.mp3']);
      expect(context.statuses).toContain('speaking');
      expect(context.base.speak).not.toHaveBeenCalled();
    });
    it('si no se puede oír nada, lo informa como error', async () => {
      const context = setup();
      await say(context, 'frase sin grabar.');
      expect(context.controller.snapshot().status.code).toBe('error');
      expect(context.base.speak).not.toHaveBeenCalled();
    });
    it('aunque se pida una voz del navegador, habla Inti', async () => {
      const context = setup();
      context.controller.configure({ voiceURI: 'local' });
      await say(context, '¡muy bien!');
      expect(context.audio.played).toHaveLength(1);
      expect(context.base.speak).not.toHaveBeenCalled();
    });
  });

  describe('precarga', () => {
    it('al hablar por primera vez descarga todo y usa la copia local', async () => {
      const preload = vi.fn(async (url: string) => `blob:${url}`);
      const context = setup(CLIPS, { preload });
      expect(preload).not.toHaveBeenCalled(); // no data use until asked
      await say(context, '¡muy bien!', '1');
      expect(preload).toHaveBeenCalledTimes(2);
      await finish(context.audio);
      context.controller.update({ id: '2', text: 'busca: papa.' });
      await flush();
      expect(context.audio.played.at(-1)).toBe('blob:/audio/inti/b.mp3');
      expect(preload).toHaveBeenCalledTimes(2);
    });
    it('si la precarga falla, usa la dirección normal', async () => {
      const preload = vi.fn(async () => {
        throw new Error('offline');
      });
      const context = setup(CLIPS, { preload });
      await say(context, '¡muy bien!');
      expect(context.audio.played).toEqual(['/audio/inti/a.mp3']);
    });
  });

  it('si el navegador bloquea el audio, lo informa como bloqueado', async () => {
    const context = setup();
    context.audio.blocked = true;
    await say(context, '¡muy bien!');
    expect(context.controller.snapshot().status.code).toBe('blocked');
  });
  it('detener corta el audio y no sigue con la siguiente oración', async () => {
    const context = setup();
    await say(context, '¡muy bien! busca: papa.');
    const resume = context.audio.onended!;
    context.controller.stop();
    expect(context.audio.pause).toHaveBeenCalled();
    resume();
    await flush();
    expect(context.audio.played).toHaveLength(1);
  });
});
