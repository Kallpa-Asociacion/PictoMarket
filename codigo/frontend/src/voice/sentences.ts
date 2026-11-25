/** Recordings are made and reused one sentence at a time. */
export const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
