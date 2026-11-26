import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './usePolling';

const MINUTE = 60_000;

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

// ADR-043: la campana consulta cada 60 s mientras la app está visible, y nunca con la pestaña oculta.
describe('consulta periódica de los avisos (ADR-043)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('consulta al abrir y devuelve lo que respondió el servidor', async () => {
    const load = vi.fn(() => Promise.resolve(3));

    const { result } = renderHook(() => usePolling(load, MINUTE));
    await vi.advanceTimersByTimeAsync(0);

    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(3);
  });
});
