import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './usePolling';

const MINUTE = 60_000;

// Avanza el reloj falso y deja que React aplique lo que respondió cada consulta.
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

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
    await advance(0);

    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(3);
  });

  it('vuelve a consultar cada 60 s y muestra el número nuevo', async () => {
    const load = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2);

    const { result } = renderHook(() => usePolling(load, MINUTE));
    await advance(0);
    await advance(MINUTE - 1);
    expect(load).toHaveBeenCalledTimes(1);

    await advance(1);

    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(2);
  });

  // La pestaña oculta no gasta datos ni batería (ADR-031); al volver, se actualiza de inmediato.
  it('no consulta con la pestaña oculta y consulta apenas vuelve a estar visible', async () => {
    const load = vi.fn(() => Promise.resolve(1));
    renderHook(() => usePolling(load, MINUTE));
    await advance(0);

    act(() => {
      setVisibility('hidden');
    });
    await advance(5 * MINUTE);
    expect(load).toHaveBeenCalledTimes(1);

    act(() => {
      setVisibility('visible');
    });
    await advance(0);

    expect(load).toHaveBeenCalledTimes(2);
  });
});
