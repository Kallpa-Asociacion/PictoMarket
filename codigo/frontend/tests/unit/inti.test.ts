import { existsSync } from 'node:fs';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BASE_POSES, GESTURE_MS, POSES, poseFor } from '../../src/guide/poses';
import { useIntiPose } from '../../src/guide/useIntiPose';

describe('poses de Inti', () => {
  it('cada pose tiene su imagen', () => {
    for (const pose of POSES)
      expect(
        existsSync(`${process.cwd()}/public/art/inti/${pose}.webp`),
        pose,
      ).toBe(true);
  });
  it('cada momento tiene un gesto', () => {
    expect(poseFor('greet')).toBe('saludo');
    expect(poseFor('celebrate')).toBe('pulgar');
    expect(poseFor('celebrate', { complete: true })).toBe('celebra');
    expect(poseFor('think')).toBe('piensa');
    expect(poseFor('point')).toBe('senala');
    expect(poseFor('encourage')).toBe('animo');
    expect(poseFor('explain')).toBe('sorpresa');
    expect(poseFor('explain', { pointing: true })).toBe('senala');
  });
  it('nunca usa una cara de enojo ante un error', () => {
    expect(POSES.join(' ')).not.toMatch(/enojo|molesto/);
  });
});

describe('animación', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const start = (props: Partial<Parameters<typeof useIntiPose>[0]> = {}) =>
    renderHook((next) => useIntiPose(next), {
      initialProps: {
        lineId: '1',
        text: 'Busca la leche, por favor.',
        gesture: 'saludo' as const,
        speaking: false,
        voiceOn: false,
        ...props,
      },
    });
  /** Poses seen while `ms` pass. */
  function watch(result: { current: string }, ms: number) {
    const seen = new Set<string>();
    for (let t = 0; t < ms; t += 40) {
      act(() => vi.advanceTimersByTime(40));
      seen.add(result.current);
    }
    return seen;
  }

  it('empieza con el gesto, luego habla y termina en reposo', () => {
    const { result } = start();
    expect(result.current).toBe('saludo');
    act(() => vi.advanceTimersByTime(GESTURE_MS + 20));
    const talking = watch(result, 700);
    expect([...talking].sort()).toEqual(
      ['habla-abierta', 'habla-media', 'reposo'].sort(),
    );
    act(() => vi.advanceTimersByTime(7000));
    expect(['reposo', 'parpadeo']).toContain(result.current);
  });
  it('en reposo parpadea de vez en cuando', () => {
    const { result } = start();
    act(() => vi.advanceTimersByTime(9000));
    const resting = watch(result, 8000);
    expect([...resting].sort()).toEqual(['parpadeo', 'reposo']);
  });
  it('con la voz activa mueve la boca solo mientras suena', () => {
    const view = start({ voiceOn: true, speaking: true });
    act(() => vi.advanceTimersByTime(GESTURE_MS + 20));
    expect(watch(view.result, 800).has('habla-abierta')).toBe(true);
    view.rerender({
      lineId: '1',
      text: 'Busca la leche, por favor.',
      gesture: 'saludo',
      speaking: false,
      voiceOn: true,
    });
    const silent = watch(view.result, 1500);
    expect(silent.has('habla-abierta')).toBe(false);
    expect(silent.has('habla-media')).toBe(false);
  });
  it('una línea nueva vuelve a mostrar su gesto', () => {
    const view = start();
    act(() => vi.advanceTimersByTime(9000));
    view.rerender({
      lineId: '2',
      text: 'Mira.',
      gesture: 'saludo',
      speaking: false,
      voiceOn: false,
    });
    expect(view.result.current).toBe('saludo');
  });
  it('la celebración final se queda celebrando', () => {
    const { result } = start({ gesture: 'celebra' });
    act(() => vi.advanceTimersByTime(12000));
    expect(result.current).toBe('celebra');
  });
  it('con movimiento reducido solo muestra el gesto, sin cambios', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    const { result } = start();
    expect(watch(result, 9000)).toEqual(new Set(['saludo']));
  });
  it('las poses base comparten encuadre para hablar sin saltos', () => {
    expect(BASE_POSES).toEqual([
      'reposo',
      'habla-media',
      'habla-abierta',
      'parpadeo',
    ]);
  });
});
