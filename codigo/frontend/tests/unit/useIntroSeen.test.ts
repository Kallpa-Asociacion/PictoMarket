import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INTRO_SEEN_KEY, useIntroSeen } from '../../src/hooks/useIntroSeen';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('useIntroSeen', () => {
  it('empieza en falso y persiste markSeen / clear', () => {
    const { result } = renderHook(() => useIntroSeen());
    expect(result.current.seen).toBe(false);
    act(() => result.current.markSeen());
    expect(result.current.seen).toBe(true);
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('1');
    act(() => result.current.clear());
    expect(result.current.seen).toBe(false);
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBeNull();
  });
  it('lee el valor guardado', () => {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
    const { result } = renderHook(() => useIntroSeen());
    expect(result.current.seen).toBe(true);
  });
  it('si localStorage lanza error, no rompe y seen es falso', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', {
      getItem: boom,
      setItem: boom,
      removeItem: boom,
    });
    const { result } = renderHook(() => useIntroSeen());
    expect(result.current.seen).toBe(false);
    expect(() => act(() => result.current.markSeen())).not.toThrow();
    expect(() => act(() => result.current.clear())).not.toThrow();
    expect(result.current.seen).toBe(false);
  });
  it('si no se puede escribir, la sesión actual igualmente la recuerda', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: boom,
      removeItem: boom,
    });
    const { result } = renderHook(() => useIntroSeen());
    act(() => result.current.markSeen());
    expect(result.current.seen).toBe(true);
  });
});
