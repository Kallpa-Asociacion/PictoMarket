// Logic of the voice recorder, separated so it can be tested without spending
// ElevenLabs credits. See generate-voice.mjs for the command line.

import { createHash } from 'node:crypto';

const API = 'https://api.elevenlabs.io/v1/text-to-speech';
// Enough for speech and half the size of 128 kbps.
const FORMAT = 'mp3_44100_64';

/** Stable file name for a sentence: readable slug plus a short hash. */
export function clipFile(key) {
  const slug = key
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 8);
  return `${slug}-${hash}.mp3`;
}

/** What is still missing. Recorded sentences are never requested again. */
export function planRecording(phrases, existing, check) {
  if (check) {
    const { manifest, voiceId, model } = check;
    const hasClips = Object.keys(manifest.clips).length > 0;
    if (
      hasClips &&
      manifest.voiceId &&
      (manifest.voiceId !== voiceId || manifest.model !== model)
    )
      throw new Error(
        'Las grabaciones existentes son de otra voz o modelo. Para no mezclar ' +
          'voces, usa los mismos valores o añade --force para volver a grabar todo.',
      );
  }
  const wanted = new Set(phrases.map((phrase) => clipFile(phrase.key)));
  const pending = phrases.filter(
    (phrase) => !existing.has(clipFile(phrase.key)),
  );
  return {
    pending,
    recorded: phrases.length - pending.length,
    characters: pending.reduce((sum, phrase) => sum + phrase.text.length, 0),
    orphans: [...existing].filter((file) => !wanted.has(file)),
  };
}

export function manifestFor(phrases, existing, { voiceId, model }) {
  const clips = {};
  for (const phrase of phrases) {
    const file = clipFile(phrase.key);
    if (existing.has(file)) clips[phrase.key] = file;
  }
  return { voiceId, model, clips };
}

const isMp3 = (bytes) =>
  // ID3 tag or an MPEG frame sync.
  (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
  (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);

/** Records the pending sentences one by one and stops at the first problem. */
export async function record(
  pending,
  {
    apiKey,
    voiceId,
    model,
    maxCharacters = Infinity,
    fetchImpl = fetch,
    saveClip,
    saveManifest,
    log = () => {},
  },
) {
  let done = 0;
  let characters = 0;
  const scrub = (text) => text.replaceAll(apiKey, '***').slice(0, 300);
  for (const phrase of pending) {
    if (characters + phrase.text.length > maxCharacters)
      return { done, characters, stoppedByLimit: true };
    try {
      const response = await fetchImpl(
        `${API}/${encodeURIComponent(voiceId)}?output_format=${FORMAT}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: phrase.text, model_id: model }),
          signal: AbortSignal.timeout(60000),
        },
      );
      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!isMp3(bytes)) throw new Error('La respuesta no es un audio MP3.');
      await saveClip(clipFile(phrase.key), bytes);
      done++;
      characters += phrase.text.length;
      await saveManifest();
      log(`${done}/${pending.length}  ${phrase.text}`);
    } catch (error) {
      return {
        done,
        characters,
        error: scrub(`"${phrase.text}" -> ${error.message}`),
      };
    }
  }
  return { done, characters };
}
