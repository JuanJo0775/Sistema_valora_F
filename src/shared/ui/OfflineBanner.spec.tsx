import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from './OfflineBanner';
import { OfflineMessage } from './OfflineMessage';

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
      'Sin conexión: te mostramos lo último que viste.',
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

  it('si la pantalla explica su propio estado, el aviso global se esconde (un solo mensaje)', () => {
    render(
      <>
        <OfflineBanner />
        <OfflineMessage>Sin conexión: esta pantalla necesita internet.</OfflineMessage>
      </>,
    );
    goOffline();

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('esta pantalla necesita internet');
  });
});
