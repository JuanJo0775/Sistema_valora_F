import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api';
import { ErrorState } from './ErrorState';

describe('estado de error', () => {
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
});
