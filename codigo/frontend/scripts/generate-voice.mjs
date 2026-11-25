// Records Inti's voice with ElevenLabs ONCE. The game only plays the saved
// files; it never calls ElevenLabs.
//
//   npm run voz:lista     what is missing and how many characters (free)
//   npm run voz:grabar    records only the missing sentences (spends credits)
//   npm run voz:sync      registers files you recorded by hand (free)
//
// Options: --max-chars=500  stop before spending more than that
//          --force          record everything again (for a new voice)
// Credentials: codigo/frontend/.env.local (see .env.example). Never commit it.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { clipFile, manifestFor, planRecording, record } from './voice-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const audioDir = new URL('../public/audio/inti/', import.meta.url);
const manifestUrl = new URL('../src/voice/manifest.json', import.meta.url);
const listUrl = new URL('../artifacts/frases-voz.csv', import.meta.url);

const args = process.argv.slice(2);
const mode = args.includes('--record')
  ? 'record'
  : args.includes('--sync')
    ? 'sync'
    : 'list';
const force = args.includes('--force');
const limit = args.find((arg) => arg.startsWith('--max-chars='));
const maxCharacters = limit ? Number(limit.split('=')[1]) : Infinity;
if (Number.isNaN(maxCharacters))
  throw new Error('--max-chars debe ser un número.');

try {
  process.loadEnvFile(new URL('../.env.local', import.meta.url));
} catch {
  // Optional: the variables may already be in the environment.
}

/** The sentences come from the game's own code (single source of truth). */
async function loadPhrases() {
  const server = await createServer({
    root,
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, host: false },
    appType: 'custom',
  });
  try {
    const module = await server.ssrLoadModule('/src/voice/phrases.ts');
    return module.allSpokenSentences();
  } finally {
    await server.close();
  }
}

const listFiles = async () =>
  new Set((await readdir(audioDir)).filter((file) => file.endsWith('.mp3')));

async function main() {
  const phrases = await loadPhrases();
  await mkdir(audioDir, { recursive: true });
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  const existing = await listFiles();
  const voiceId = process.env.ELEVENLABS_VOICE_ID || manifest.voiceId;
  const model =
    process.env.ELEVENLABS_MODEL_ID ||
    manifest.model ||
    'eleven_multilingual_v2';

  const saveManifest = async () => {
    const next = manifestFor(phrases, await listFiles(), { voiceId, model });
    await writeFile(manifestUrl, `${JSON.stringify(next, null, 2)}\n`);
    return next;
  };

  const plan = planRecording(
    phrases,
    force ? new Set() : existing,
    mode === 'record' && !force ? { manifest, voiceId, model } : undefined,
  );
  console.log(
    `Frases: ${phrases.length} | grabadas: ${plan.recorded} | ` +
      `pendientes: ${plan.pending.length} (${plan.characters} caracteres)`,
  );
  if (plan.orphans.length && !force)
    console.log(
      `Archivos que ya no se usan (puedes borrarlos): ${plan.orphans.join(', ')}`,
    );

  if (mode === 'list') {
    const quote = (text) => `"${text.replaceAll('"', '""')}"`;
    const rows = phrases.map((phrase) => {
      const file = clipFile(phrase.key);
      return [file, existing.has(file) ? 'si' : 'no', quote(phrase.text)].join(
        ',',
      );
    });
    await mkdir(new URL('./', listUrl), { recursive: true });
    await writeFile(listUrl, `﻿archivo,grabada,texto\n${rows.join('\n')}\n`);
    console.log(`Lista completa: ${fileURLToPath(listUrl)}`);
    console.log(
      'No se ha llamado a ElevenLabs. Para grabar: npm run voz:grabar',
    );
    return;
  }

  if (mode === 'sync') {
    const next = await saveManifest();
    console.log(
      `Manifiesto actualizado: ${Object.keys(next.clips).length} audios.`,
    );
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !voiceId)
    throw new Error(
      'Faltan ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID. Copia .env.example ' +
        'a .env.local y complétalo.',
    );
  const result = await record(plan.pending, {
    apiKey,
    voiceId,
    model,
    maxCharacters,
    saveClip: (file, bytes) => writeFile(new URL(file, audioDir), bytes),
    saveManifest,
    log: (line) => console.log(line),
  });
  await saveManifest();
  console.log(
    `Grabadas ahora: ${result.done} (${result.characters} caracteres).`,
  );
  if (result.stoppedByLimit)
    console.log('Se alcanzó --max-chars. Repite el comando para continuar.');
  if (result.error) {
    console.error(`Se detuvo: ${result.error}`);
    console.error(
      'Lo ya grabado quedó guardado; al repetir no se vuelve a pagar.',
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
