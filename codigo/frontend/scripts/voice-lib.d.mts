export interface Phrase {
  key: string;
  text: string;
}
export interface Manifest {
  voiceId: string;
  model: string;
  clips: Record<string, string>;
}
export function clipFile(key: string): string;
export function planRecording(
  phrases: Phrase[],
  existing: Set<string>,
  check?: { manifest: Manifest; voiceId: string; model: string },
): {
  pending: Phrase[];
  recorded: number;
  characters: number;
  orphans: string[];
};
export function manifestFor(
  phrases: Phrase[],
  existing: Set<string>,
  voice: { voiceId: string; model: string },
): Manifest;
export function record(
  pending: Phrase[],
  options: {
    apiKey: string;
    voiceId: string;
    model: string;
    maxCharacters?: number;
    fetchImpl?: unknown;
    saveClip: (file: string, bytes: Uint8Array) => Promise<void>;
    saveManifest: () => Promise<unknown>;
    log?: (line: string) => void;
  },
): Promise<{
  done: number;
  characters: number;
  stoppedByLimit?: boolean;
  error?: string;
}>;
