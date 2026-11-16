import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('estado vacío', () => {
  it('dice qué pasó, cómo seguir y ofrece la acción', () => {
    render(
      <EmptyState
        title="Sin resultados"
        text="Revisa la escritura o pide que lo agreguemos al catálogo."
        action={<button type="button">Solicitar producto</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Sin resultados' })).toBeInTheDocument();
    expect(
      screen.getByText('Revisa la escritura o pide que lo agreguemos al catálogo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicitar producto' })).toBeInTheDocument();
  });
});
