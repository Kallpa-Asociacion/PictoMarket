// Catalogue of everything the voice can say, split into sentences. Used by
// scripts/generate-voice.mjs to record each sentence once and by the player to
// find the recordings.

import { INTRO_STEPS, focusSteps } from '../content/intro';
import { market } from '../data/market';
import { DIALOGUE } from '../domain/dialogue';
import { objectiveWords, voiceText, type Challenge } from '../domain/game';
import { splitSentences } from './sentences';

export { splitSentences };

export interface SpokenSentence {
  /** Normalised form: identifies the recording. */
  key: string;
  /** Readable form sent to the voice service. */
  text: string;
}

function readable(sentence: string): string {
  return (
    sentence
      .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
      // Words in capitals would be spelled out by the voice.
      .replace(/\p{Lu}{2,}/gu, (word) => word.toLowerCase())
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function gameLines(challenge: Challenge): string[] {
  const name = (id: number) => market.catalogo[id].nombre.toLowerCase();
  const list = challenge.lista_correcta;
  const meal = objectiveWords(challenge).at(-1)!.toLowerCase();
  const lines = [DIALOGUE.start(meal, name(list[0]))];
  // Any pending product can be bought, in any order.
  list.forEach((_, index) => {
    for (const bought of list) {
      if (index === list.length - 1)
        lines.push(DIALOGUE.bought(index + 1, name(bought)));
      else
        for (const next of list)
          if (next !== bought)
            lines.push(DIALOGUE.bought(index + 1, name(bought), name(next)));
    }
  });
  for (const target of list) {
    const category = market.categorias[market.catalogo[target].categoria];
    for (const touched of challenge.distractores)
      lines.push(
        DIALOGUE.categoryHint(
          name(touched),
          category.icono,
          category.nombre.toLowerCase(),
        ),
      );
    lines.push(
      DIALOGUE.removedProduct(name(target)),
      DIALOGUE.pointing(name(target)),
      DIALOGUE.tryAgain(name(target)),
    );
  }
  return lines;
}

function demoLines(challenge: Challenge): string[] {
  const named = (id: number) => ({ id, name: market.catalogo[id].nombre });
  const list = challenge.lista_correcta;
  const decoy = challenge.distractores[0];
  // The tour can be replayed mid-game, so any two pending products can appear.
  return list.flatMap((first) =>
    [undefined, ...list.filter((id) => id !== first)].flatMap((second) =>
      [decoy, undefined].flatMap((wrong) =>
        focusSteps({
          first: named(first),
          second: second === undefined ? undefined : named(second),
          decoy: wrong,
        }).map((step) => step.text),
      ),
    ),
  );
}

export function allSpokenSentences(): SpokenSentence[] {
  const lines = [
    DIALOGUE.home,
    ...INTRO_STEPS.map((step) => step.text),
    ...market.retos.flatMap(demoLines),
    ...market.retos.flatMap(gameLines),
  ];
  const unique = new Map<string, string>();
  for (const sentence of lines.flatMap(splitSentences)) {
    const key = voiceText(sentence);
    if (key && !unique.has(key)) unique.set(key, readable(sentence));
  }
  return [...unique].map(([key, text]) => ({ key, text }));
}
