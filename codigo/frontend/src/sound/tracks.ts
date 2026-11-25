// Original background music written as data and synthesised in the browser
// (see engine.ts): no audio files, no licences, works offline.

export type TrackId = 'home' | 'game' | 'therapist' | 'celebration';
export type Instrument =
  'marimba' | 'pluck' | 'bell' | 'pad' | 'bass' | 'shaker';
/** [start beat, MIDI note, length in beats] */
export type Note = [number, number, number];

export interface Layer {
  instrument: Instrument;
  /** Relative loudness inside the track, 0..1. */
  gain: number;
  notes: Note[];
}
export interface Track {
  label: string;
  bpm: number;
  /** Loop length in beats. */
  beats: number;
  layers: Layer[];
}

const chord = (beat: number, midis: number[], length: number): Note[] =>
  midis.map((midi) => [beat, midi, length]);
/** One note per [offset, midi, length], shifted to start at `beat`. */
const phrase = (beat: number, notes: Note[]): Note[] =>
  notes.map(([offset, midi, length]) => [beat + offset, midi, length]);
const every = (step: number, from: number, to: number, midi: number): Note[] =>
  Array.from({ length: Math.ceil((to - from) / step) }, (_, index) => [
    from + index * step,
    midi,
    step / 2,
  ]);

// Home: cheerful market welcome. C major, bouncy marimba (C - G - Am - F).
const home: Track = {
  label: 'Bienvenida al mercado',
  bpm: 108,
  beats: 16,
  layers: [
    {
      instrument: 'marimba',
      gain: 0.5,
      notes: [
        ...phrase(0, [
          [0, 76, 0.5],
          [0.5, 79, 0.5],
          [1, 84, 0.5],
          [2, 79, 0.5],
          [2.5, 76, 0.5],
          [3, 79, 1],
        ]),
        ...phrase(4, [
          [0, 74, 0.5],
          [0.5, 79, 0.5],
          [1, 83, 0.5],
          [2, 79, 0.5],
          [2.5, 74, 0.5],
          [3, 79, 1],
        ]),
        ...phrase(8, [
          [0, 76, 0.5],
          [0.5, 81, 0.5],
          [1, 84, 0.5],
          [2, 81, 0.5],
          [2.5, 76, 0.5],
          [3, 72, 1],
        ]),
        ...phrase(12, [
          [0, 77, 0.5],
          [0.5, 81, 0.5],
          [1, 84, 0.5],
          [2, 81, 0.5],
          [2.5, 79, 0.5],
          [3, 74, 1],
        ]),
      ],
    },
    {
      instrument: 'pad',
      gain: 0.12,
      notes: [
        ...chord(0, [60, 64, 67], 4),
        ...chord(4, [59, 62, 67], 4),
        ...chord(8, [57, 60, 64], 4),
        ...chord(12, [57, 60, 65], 4),
      ],
    },
    {
      instrument: 'bass',
      gain: 0.35,
      notes: [48, 43, 45, 41].flatMap((root, bar): Note[] => [
        [bar * 4, root, 1],
        [bar * 4 + 2, root + 7, 1],
      ]),
    },
    { instrument: 'shaker', gain: 0.12, notes: every(1, 0.5, 16, 80) },
  ],
};

// Game: calm and sparse so the player can concentrate. F major pentatonic,
// soft plucks over a warm pad, no percussion.
const game: Track = {
  label: 'Comprando con calma',
  bpm: 82,
  beats: 16,
  layers: [
    {
      instrument: 'pluck',
      gain: 0.3,
      notes: [
        [0, 69, 1],
        [1.5, 72, 1],
        [3, 74, 1],
        [4, 72, 2],
        [6.5, 69, 1],
        [8, 67, 1],
        [9.5, 69, 1],
        [11, 72, 1],
        [12, 69, 1],
        [13.5, 67, 1],
        [14.5, 65, 1.5],
      ],
    },
    {
      instrument: 'pad',
      gain: 0.16,
      notes: [
        ...chord(0, [53, 57, 60], 4),
        ...chord(4, [50, 53, 57], 4),
        ...chord(8, [46, 50, 53], 4),
        ...chord(12, [48, 52, 55], 4),
      ],
    },
    {
      instrument: 'bass',
      gain: 0.18,
      notes: [
        [0, 41, 3],
        [4, 38, 3],
        [8, 34, 3],
        [12, 36, 3],
      ],
    },
  ],
};

// Therapist panel: very slow ambient pad with a few bells, made for reading.
const therapist: Track = {
  label: 'Sala tranquila',
  bpm: 60,
  beats: 16,
  layers: [
    {
      instrument: 'pad',
      gain: 0.2,
      notes: [
        ...chord(0, [50, 57, 61, 66], 8),
        ...chord(8, [55, 59, 62, 66], 8),
      ],
    },
    {
      instrument: 'bell',
      gain: 0.14,
      notes: [
        [1, 78, 3],
        [5, 81, 3],
        [9, 74, 3],
        [13, 73, 3],
      ],
    },
  ],
};

// List completed: short festive loop.
const celebration: Track = {
  label: 'Compra lograda',
  bpm: 124,
  beats: 8,
  layers: [
    {
      instrument: 'marimba',
      gain: 0.5,
      notes: [
        [60, 64, 67, 72],
        [65, 69, 72, 77],
        [67, 71, 74, 79],
        [72, 76, 79, 84],
      ].flatMap((arpeggio, half) =>
        arpeggio.map((midi, step): Note => [
          half * 2 + step * 0.5,
          midi + 12,
          0.5,
        ]),
      ),
    },
    {
      instrument: 'bass',
      gain: 0.35,
      notes: [
        [0, 48, 1.5],
        [2, 41, 1.5],
        [4, 43, 1.5],
        [6, 48, 1.5],
      ],
    },
    { instrument: 'shaker', gain: 0.16, notes: every(0.5, 0, 8, 80) },
  ],
};

export const TRACKS: Record<TrackId, Track> = {
  home,
  game,
  therapist,
  celebration,
};
