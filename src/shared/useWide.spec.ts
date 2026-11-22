import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubMatchMedia } from '../test/matchMedia';
import { useWide } from './useWide';

describe('useWide: ¿la ventana es de computador?', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin matchMedia (jsdom) es falso: se ve la pantalla angosta', () => {
    const { result } = renderHook(() => useWide());

    expect(result.current).toBe(false);
  });

  it('con una ventana ancha es verdadero, y angosta es falso', () => {
    stubMatchMedia(true);
    expect(renderHook(() => useWide()).result.current).toBe(true);

    stubMatchMedia(false);
    expect(renderHook(() => useWide()).result.current).toBe(false);
  });

  it('cambia cuando se redimensiona la ventana y deja de escuchar al desmontar', () => {
    const media = stubMatchMedia(false);
    const { result, unmount } = renderHook(() => useWide());
    expect(media.listeners.size).toBe(1);

    act(() => {
      media.set(true);
    });
    expect(result.current).toBe(true);

    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
