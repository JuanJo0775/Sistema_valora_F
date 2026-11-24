import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubMatchMedia } from '../test/matchMedia';
import { useMediaQuery } from './useMediaQuery';

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin matchMedia (jsdom, navegadores viejos) vale false', () => {
    const { result } = renderHook(() => useMediaQuery('(width < 960px)'));
    expect(result.current).toBe(false);
  });

  it('lee la consulta y sigue los cambios de la ventana', () => {
    const media = stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(width < 960px)'));
    expect(result.current).toBe(true);
    act(() => {
      media.set(false);
    });
    expect(result.current).toBe(false);
  });

  it('deja de escuchar al desmontar', () => {
    const media = stubMatchMedia(true);
    const { unmount } = renderHook(() => useMediaQuery('(width < 960px)'));
    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
