import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import { ErrorState } from './ErrorState';

describe('estado de error', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el mensaje que trae la API', () => {
    const error = new ApiError({
      status: 404,
      code: 'NOT_FOUND',
      message: 'No existe el producto.',
    });

    render(<ErrorState error={error} />);

    expect(screen.getByRole('alert')).toHaveTextContent('No existe el producto.');
  });

  it('un error que no viene de la API muestra un mensaje genérico', () => {
    render(<ErrorState error={new Error('undefined is not a function')} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal. Inténtalo de nuevo.');
  });

  it('con «Reintentar» se vuelve a intentar', () => {
    const retry = vi.fn();
    const offline = new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Sin conexión.' });
    render(<ErrorState error={offline} onRetry={retry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(retry).toHaveBeenCalledOnce();
  });

  describe('sin conexión del navegador', () => {
    const offline = new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'No hay conexión.' });

    it('da un solo mensaje claro y no ofrece «Reintentar»', () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      render(<ErrorState error={offline} onRetry={vi.fn()} />);

      expect(screen.getByRole('status')).toHaveTextContent(
        'Sin conexión: esta pantalla necesita internet.',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    });

    it('vuelve a intentar solo cuando regresa la conexión', () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const retry = vi.fn();
      render(<ErrorState error={offline} onRetry={retry} />);

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(retry).toHaveBeenCalledOnce();
    });
  });
});
