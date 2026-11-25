import { describe, expect, it, vi } from 'vitest';
import {
  clipFile,
  manifestFor,
  planRecording,
  record,
} from '../../scripts/voice-lib.mjs';

const phrases = [
  { key: '¡muy bien!', text: '¡Muy bien!' },
  { key: 'busca: papa.', text: 'Busca: papa.' },
  { key: 'soy inti.', text: 'Soy Inti.' },
];
const voice = { voiceId: 'voz123', model: 'eleven_multilingual_v2' };
const empty = { voiceId: '', model: '', clips: {} };
const audio = () =>
  Promise.resolve(new Response(new Uint8Array([73, 68, 51, 4])));
const options = (overrides = {}) => ({
  ...voice,
  apiKey: 'clave-secreta',
  fetchImpl: vi.fn(audio),
  saveClip: vi.fn(async () => {}),
  saveManifest: vi.fn(async () => {}),
  ...overrides,
});

describe('nombres de archivo', () => {
  it('son estables, legibles y distintos por frase', () => {
    expect(clipFile('busca: papa.')).toBe(clipFile('busca: papa.'));
    expect(clipFile('busca: papa.')).toMatch(/^busca-papa-[0-9a-f]{8}\.mp3$/);
    expect(clipFile('¿ya?')).not.toBe(clipFile('¡ya!'));
  });
});

describe('plan: no gastar dos veces', () => {
  it('solo pide lo que no está grabado', () => {
    const existing = new Set([clipFile('¡muy bien!')]);
    const plan = planRecording(phrases, existing);
    expect(plan.pending.map((p) => p.key)).toEqual([
      'busca: papa.',
      'soy inti.',
    ]);
    expect(plan.characters).toBe('Busca: papa.Soy Inti.'.length);
    expect(plan.recorded).toBe(1);
  });
  it('detecta grabaciones que ya no se usan', () => {
    const plan = planRecording(phrases, new Set(['vieja-00000000.mp3']));
    expect(plan.orphans).toEqual(['vieja-00000000.mp3']);
  });
  it('el manifiesto solo incluye archivos que existen', () => {
    const existing = new Set([clipFile('soy inti.')]);
    expect(manifestFor(phrases, existing, voice).clips).toEqual({
      'soy inti.': clipFile('soy inti.'),
    });
  });
});

describe('grabación con ElevenLabs', () => {
  const pending = planRecording(phrases, new Set()).pending;

  it('llama a la API una vez por frase y guarda el avance tras cada una', async () => {
    const run = options();
    const result = await record(pending, run);
    expect(result.done).toBe(3);
    expect(run.fetchImpl).toHaveBeenCalledTimes(3);
    const [url, init] = run.fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/voz123?output_format=mp3_44100_64',
    );
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe(
      'clave-secreta',
    );
    expect(JSON.parse(String(init.body))).toEqual({
      text: '¡Muy bien!',
      model_id: 'eleven_multilingual_v2',
    });
    expect(run.saveClip).toHaveBeenCalledTimes(3);
    expect(run.saveManifest).toHaveBeenCalledTimes(3);
  });
  it('se detiene en el primer error sin perder lo ya grabado ni mostrar la clave', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(audio)
      .mockResolvedValue(
        new Response('{"detail":"quota_exceeded clave-secreta"}', {
          status: 401,
        }),
      );
    const run = options({ fetchImpl });
    const result = await record(pending, run);
    expect(result.done).toBe(1);
    expect(result.error).toContain('401');
    expect(result.error).toContain('quota_exceeded');
    expect(result.error).not.toContain('clave-secreta');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(run.saveClip).toHaveBeenCalledTimes(1);
  });
  it('respeta el tope de caracteres', async () => {
    const run = options({ maxCharacters: '¡Muy bien!'.length + 3 });
    const result = await record(pending, run);
    expect(result.done).toBe(1);
    expect(run.fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.stoppedByLimit).toBe(true);
  });
  it('rechaza una respuesta que no es audio', async () => {
    const run = options({
      fetchImpl: vi.fn(() => Promise.resolve(new Response('{"ok":true}'))),
    });
    const result = await record(pending, run);
    expect(result.done).toBe(0);
    expect(run.saveClip).not.toHaveBeenCalled();
  });
  it('un manifiesto de otra voz obliga a confirmarlo', () => {
    expect(() =>
      planRecording(phrases, new Set(), {
        manifest: { ...empty, voiceId: 'otra', clips: { a: 'a.mp3' } },
        ...voice,
      }),
    ).toThrow(/otra voz/);
    expect(() =>
      planRecording(phrases, new Set(), { manifest: empty, ...voice }),
    ).not.toThrow();
  });
});
