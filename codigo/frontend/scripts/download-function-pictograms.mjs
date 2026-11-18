import { readFile, writeFile, mkdir } from 'node:fs/promises';
let words;
let escenarios;
try {
  words = JSON.parse(
    await readFile(
      new URL('../../../datos/pictogramas_funcion.json', import.meta.url),
      'utf8',
    ),
  );
  escenarios = JSON.parse(
    await readFile(
      new URL('../../../datos/escenarios.json', import.meta.url),
      'utf8',
    ),
  );
} catch (cause) {
  throw new Error('No se pudieron leer los datos de pictogramas de función.', {
    cause,
  });
}
const folder = new URL('../public/pictograms/', import.meta.url);
await mkdir(folder, { recursive: true });
// Idempotent and bounded: a failure never substitutes a pictogram silently.
const entries = Object.entries(words.funcion);
for (let offset = 0; offset < entries.length; offset += 4) {
  await Promise.all(
    entries.slice(offset, offset + 4).map(async ([key, entry]) => {
      const url = escenarios.url_pictograma.replaceAll('{id}', entry.id);
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok)
        throw new Error(`${key} (${entry.id}): HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
        throw new Error(`${key} (${entry.id}): no es PNG`);
      await writeFile(new URL(`${entry.id}.png`, folder), bytes);
      console.log(`${entry.id}: ${entry.palabra}`);
    }),
  );
}
