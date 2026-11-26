import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allSpokenSentences } from '../../src/voice/phrases';

// Reads the committed manifest from disk (setup.ts mocks the imported one).
// With recordings there is no other voice, so a sentence without audio would
// be silent: this fails when a dialogue changes and has not been recorded.
const manifest = JSON.parse(
  readFileSync(`${process.cwd()}/src/voice/manifest.json`, 'utf8'),
) as { clips: Record<string, string> };
const recorded = Object.keys(manifest.clips).length > 0;

describe.skipIf(!recorded)('grabaciones completas', () => {
  it('cada oración que puede decir la app tiene su audio', () => {
    const missing = allSpokenSentences()
      .filter((sentence) => !(sentence.key in manifest.clips))
      .map((sentence) => sentence.text);
    expect(missing, 'graba estas frases (npm run voz:lista)').toEqual([]);
  });
  it('cada audio del manifiesto existe en la aplicación', () => {
    const missing = Object.values(manifest.clips).filter(
      (file) => !existsSync(`${process.cwd()}/public/audio/inti/${file}`),
    );
    expect(missing).toEqual([]);
  });
});
