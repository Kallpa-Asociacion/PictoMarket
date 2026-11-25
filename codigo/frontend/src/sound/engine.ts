// Small Web Audio engine: loops the background track of the current context,
// cross-fades between contexts and plays short effects. Audio is only created
// by unlock(), which must run inside a user gesture (browser autoplay rules).

import { TRACKS, type Instrument, type TrackId } from './tracks';

export type EffectName = 'success' | 'hint';

/** Music level while the voice is speaking. */
export const DUCK_FACTOR = 0.2;
const FADE_SECONDS = 0.9;
const LOOKAHEAD_SECONDS = 0.35;
const TICK_MS = 100;
const SILENT = 0.0001;

// Gentle on purpose: a wrong touch gets a soft two-note cue, never a buzzer
// (errorless learning).
const EFFECTS: Record<EffectName, { midi: number; at: number }[]> = {
  success: [
    { midi: 76, at: 0 },
    { midi: 80, at: 0.09 },
    { midi: 83, at: 0.18 },
    { midi: 88, at: 0.27 },
  ],
  hint: [
    { midi: 67, at: 0 },
    { midi: 72, at: 0.16 },
  ],
};

const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

interface Voice {
  type: OscillatorType;
  attack: number;
  /** Fixed ring time in seconds; sustained voices use the note length. */
  decay?: number;
  /** Extra partial as [frequency ratio, relative gain]. */
  partial?: [number, number];
}
const VOICES: Record<Exclude<Instrument, 'shaker'>, Voice> = {
  marimba: { type: 'sine', attack: 0.005, decay: 0.45, partial: [4, 0.18] },
  pluck: { type: 'triangle', attack: 0.01, decay: 1.1 },
  bell: { type: 'sine', attack: 0.01, decay: 2.6, partial: [2.76, 0.12] },
  pad: { type: 'triangle', attack: 0.7, partial: [1.004, 0.8] },
  bass: { type: 'sine', attack: 0.03 },
};

export function createSoundEngine(factory?: () => AudioContext) {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let effectsBus: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let bus: GainNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let wanted: TrackId | null = null;
  let destroyed = false;
  const settings = {
    music: true,
    effects: true,
    volume: 0.35,
    ducked: false,
    hidden: false,
  };

  function applyLevels() {
    if (!context || !master || !effectsBus) return;
    const music = settings.volume * (settings.ducked ? DUCK_FACTOR : 1);
    master.gain.setTargetAtTime(music, context.currentTime, 0.12);
    effectsBus.gain.setTargetAtTime(
      Math.min(1, settings.volume + 0.2),
      context.currentTime,
      0.05,
    );
  }

  function tone(
    output: AudioNode,
    voice: Voice,
    midi: number,
    at: number,
    length: number,
    level: number,
  ) {
    if (!context) return;
    const duration = voice.decay ?? Math.max(length, voice.attack + 0.1);
    const partials: [number, number][] = [[1, 1]];
    if (voice.partial) partials.push(voice.partial);
    for (const [ratio, share] of partials) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = voice.type;
      oscillator.frequency.setValueAtTime(frequency(midi) * ratio, at);
      envelope.gain.setValueAtTime(SILENT, at);
      envelope.gain.linearRampToValueAtTime(level * share, at + voice.attack);
      envelope.gain.exponentialRampToValueAtTime(SILENT, at + duration);
      oscillator.connect(envelope);
      envelope.connect(output);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.05);
    }
  }

  function shake(output: AudioNode, at: number, level: number) {
    if (!context) return;
    if (!noise) {
      const size = Math.ceil(context.sampleRate * 0.07);
      noise = context.createBuffer(1, size, context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < size; i++)
        samples[i] = (Math.random() * 2 - 1) * (1 - i / size);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noise;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5000, at);
    envelope.gain.setValueAtTime(level, at);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(output);
    source.start(at);
  }

  function stopTrack() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    const old = bus;
    bus = null;
    if (!old || !context) return;
    old.gain.cancelScheduledValues(context.currentTime);
    old.gain.setValueAtTime(old.gain.value, context.currentTime);
    old.gain.linearRampToValueAtTime(0, context.currentTime + FADE_SECONDS);
    setTimeout(() => old.disconnect(), (FADE_SECONDS + 0.3) * 1000);
  }

  function startTrack() {
    stopTrack();
    if (!context || !master || !wanted || !settings.music || settings.hidden)
      return;
    const audio = context;
    const track = TRACKS[wanted];
    const output = audio.createGain();
    output.gain.setValueAtTime(0, audio.currentTime);
    output.gain.linearRampToValueAtTime(1, audio.currentTime + FADE_SECONDS);
    output.connect(master);
    bus = output;

    const events = track.layers
      .flatMap((layer) =>
        layer.notes.map(([beat, midi, length]) => ({
          beat,
          midi,
          length,
          layer,
        })),
      )
      .sort((a, b) => a.beat - b.beat);
    const secondsPerBeat = 60 / track.bpm;
    let loopStart = audio.currentTime + 0.05;
    let index = 0;
    const schedule = () => {
      let at = loopStart + events[index].beat * secondsPerBeat;
      // After a long stall, restart from now instead of bursting old notes.
      if (at < audio.currentTime - 0.5) {
        loopStart += audio.currentTime - at;
        at = audio.currentTime;
      }
      while (at < audio.currentTime + LOOKAHEAD_SECONDS) {
        const { midi, length, layer } = events[index];
        if (layer.instrument === 'shaker') shake(output, at, layer.gain);
        else
          tone(
            output,
            VOICES[layer.instrument],
            midi,
            at,
            length * secondsPerBeat,
            layer.gain,
          );
        index = (index + 1) % events.length;
        if (index === 0) loopStart += track.beats * secondsPerBeat;
        at = loopStart + events[index].beat * secondsPerBeat;
      }
    };
    schedule();
    timer = setInterval(schedule, TICK_MS);
  }

  return {
    supported: Boolean(factory),

    /** Call from a user gesture. Safe to call on every gesture. */
    unlock() {
      if (!factory || destroyed) return false;
      if (!context) {
        try {
          context = factory();
        } catch {
          return false;
        }
        master = context.createGain();
        effectsBus = context.createGain();
        master.connect(context.destination);
        effectsBus.connect(context.destination);
        master.gain.setValueAtTime(0, context.currentTime);
        applyLevels();
        if (!settings.hidden) void context.resume();
        startTrack();
      } else if (context.state !== 'running' && !settings.hidden) {
        void context.resume();
      }
      return true;
    },
    play(track: TrackId) {
      if (wanted === track) return;
      wanted = track;
      startTrack();
    },
    setMusic(enabled: boolean) {
      if (settings.music === enabled) return;
      settings.music = enabled;
      startTrack();
    },
    setEffects(enabled: boolean) {
      settings.effects = enabled;
    },
    setVolume(volume: number) {
      settings.volume = Math.min(1, Math.max(0, volume));
      applyLevels();
    },
    setDucked(ducked: boolean) {
      settings.ducked = ducked;
      applyLevels();
    },
    setHidden(hidden: boolean) {
      if (settings.hidden === hidden) return;
      settings.hidden = hidden;
      if (!context) return;
      if (hidden) {
        stopTrack();
        void context.suspend();
      } else {
        void context.resume();
        startTrack();
      }
    },
    effect(name: EffectName) {
      if (!context || !effectsBus || !settings.effects || settings.hidden)
        return;
      for (const note of EFFECTS[name])
        tone(
          effectsBus,
          VOICES.marimba,
          note.midi,
          context.currentTime + 0.02 + note.at,
          0.3,
          name === 'success' ? 0.35 : 0.22,
        );
    },
    destroy() {
      destroyed = true;
      stopTrack();
      void context?.close();
    },
    debug: () => ({ track: wanted, bus, master }),
  };
}
export type SoundEngine = ReturnType<typeof createSoundEngine>;
