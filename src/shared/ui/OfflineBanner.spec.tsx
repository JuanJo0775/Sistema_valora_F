import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setSimulatedOffline } from '../connection';
import { OfflineBanner } from './OfflineBanner';

const goOffline = () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
};

describe('aviso sin conexión', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aparece cuando el celular pierde la señal', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    goOffline();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Sin conexión. La consulta de precios necesita internet.',
    );
  });

  it('desaparece cuando vuelve la señal', () => {
    render(<OfflineBanner />);
    goOffline();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('aparece con «Simular sin conexión» y se va al apagarla', () => {
    render(<OfflineBanner />);

    act(() => {
      setSimulatedOffline(true);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión');

    act(() => {
      setSimulatedOffline(false);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
