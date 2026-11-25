import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoundEngine, DUCK_FACTOR } from '../../src/sound/engine';
import { TRACKS, type TrackId } from '../../src/sound/tracks';
import { FakeAudioContext } from './fakeAudio';

const IDS: TrackId[] = ['home', 'game', 'therapist', 'celebration'];
const make = () =>
  createSoundEngine(() => new FakeAudioContext() as unknown as AudioContext);
const context = () => FakeAudioContext.created.at(-1)!;
function advance(seconds: number) {
  for (let step = 0; step < seconds * 10; step++) {
    context().currentTime += 0.1;
    vi.advanceTimersByTime(100);
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  FakeAudioContext.created = [];
});
afterEach(() => vi.useRealTimers());

describe('pistas', () => {
  it('cada contexto tiene una pista propia y distinta', () => {
    expect(Object.keys(TRACKS).sort()).toEqual([...IDS].sort());
    const signatures = IDS.map((id) =>
      JSON.stringify([TRACKS[id].bpm, TRACKS[id].layers]),
    );
    expect(new Set(signatures).size).toBe(IDS.length);
  });
  it('las notas caben en el bucle y están en un rango audible', () => {
    for (const id of IDS)
      for (const layer of TRACKS[id].layers)
        for (const [beat, midi, length] of layer.notes) {
          expect(beat).toBeGreaterThanOrEqual(0);
          expect(beat).toBeLessThan(TRACKS[id].beats);
          expect(midi).toBeGreaterThanOrEqual(30);
          expect(midi).toBeLessThanOrEqual(100);
          expect(length).toBeGreaterThan(0);
        }
  });
  it('el juego y el panel son más tranquilos que el inicio', () => {
    expect(TRACKS.game.bpm).toBeLessThan(TRACKS.home.bpm);
    expect(TRACKS.therapist.bpm).toBeLessThan(TRACKS.game.bpm);
    const perBeat = (id: TrackId) =>
      TRACKS[id].layers.reduce((sum, layer) => sum + layer.notes.length, 0) /
      TRACKS[id].beats;
    expect(perBeat('game')).toBeLessThan(perBeat('home'));
    // No percussion while the player concentrates.
    expect(TRACKS.game.layers.map((l) => l.instrument)).not.toContain('shaker');
  });
});

describe('motor de sonido', () => {
  it('no crea audio ni suena antes del primer gesto', () => {
    const engine = make();
    engine.play('home');
    engine.effect('success');
    vi.advanceTimersByTime(1000);
    expect(FakeAudioContext.created).toHaveLength(0);
  });
  it('tras desbloquear suena la pista pedida y repite el bucle', () => {
    const engine = make();
    engine.play('home');
    engine.unlock();
    expect(context().resume).toHaveBeenCalled();
    advance(1);
    const early = context().sources.length;
    expect(early).toBeGreaterThan(0);
    advance(20);
    expect(context().sources.length).toBeGreaterThan(early * 4);
  });
  it('cambiar de pista funde la anterior y no la duplica', () => {
    const engine = make();
    engine.play('home');
    engine.unlock();
    advance(1);
    const gains = context().gains.length;
    engine.play('home');
    expect(context().gains).toHaveLength(gains);
    const bus = engine.debug().bus!;
    engine.play('therapist');
    expect(bus.gain.value).toBe(0);
    expect(engine.debug().track).toBe('therapist');
    advance(3);
    expect((bus as unknown as { disconnected: boolean }).disconnected).toBe(
      true,
    );
  });
  it('baja el volumen mientras habla la voz y lo recupera', () => {
    const engine = make();
    engine.unlock();
    engine.setVolume(0.5);
    const level = () => engine.debug().master!.gain.value;
    expect(level()).toBeCloseTo(0.5);
    engine.setDucked(true);
    expect(level()).toBeCloseTo(0.5 * DUCK_FACTOR);
    engine.setDucked(false);
    expect(level()).toBeCloseTo(0.5);
  });
  it('con la música apagada no programa notas', () => {
    const engine = make();
    engine.setMusic(false);
    engine.play('game');
    engine.unlock();
    advance(2);
    expect(context().sources).toHaveLength(0);
    engine.setMusic(true);
    advance(1);
    expect(context().sources.length).toBeGreaterThan(0);
  });
  it('los efectos suenan solo si están activados', () => {
    const engine = make();
    engine.setMusic(false);
    engine.unlock();
    engine.setEffects(false);
    engine.effect('success');
    expect(context().sources).toHaveLength(0);
    engine.setEffects(true);
    engine.effect('hint');
    expect(context().sources.length).toBeGreaterThan(0);
  });
  it('en segundo plano se suspende y al volver reanuda', () => {
    const engine = make();
    engine.play('home');
    engine.unlock();
    advance(1);
    engine.setHidden(true);
    expect(context().suspend).toHaveBeenCalled();
    const count = context().sources.length;
    advance(3);
    expect(context().sources).toHaveLength(count);
    engine.setHidden(false);
    advance(1);
    expect(context().sources.length).toBeGreaterThan(count);
  });
  it('destroy detiene el planificador y cierra el audio', () => {
    const engine = make();
    engine.play('home');
    engine.unlock();
    advance(1);
    engine.destroy();
    const count = context().sources.length;
    advance(3);
    expect(context().sources).toHaveLength(count);
    expect(context().close).toHaveBeenCalled();
  });
  it('sin Web Audio no falla', () => {
    const engine = createSoundEngine(undefined);
    expect(engine.supported).toBe(false);
    expect(() => {
      engine.play('home');
      engine.unlock();
      engine.effect('success');
      engine.destroy();
    }).not.toThrow();
  });
});
