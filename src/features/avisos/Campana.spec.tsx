import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { type Avisos, AvisosContext } from './avisosContext';
import { Campana } from './Campana';

const renderBell = (avisos: Avisos) =>
  render(
    <MemoryRouter>
      <AvisosContext.Provider value={avisos}>
        <Campana />
      </AvisosContext.Provider>
    </MemoryRouter>,
  );

const COUNTS = { precios: 2, tiendas: 0, productos: 0, comercios: 1 };

// ADR-043: la campana dice cuántos casos esperan al moderador, sin tener que revisar las cinco colas.
describe('campana de avisos del moderador (ADR-043)', () => {
  it('muestra el total de pendientes y lo dice con palabras para el lector de pantalla', () => {
    renderBell({ kind: 'moderador', counts: COUNTS });

    const bell = screen.getByRole('button', { name: 'Avisos: 3 pendientes' });
    expect(bell).toHaveTextContent('3');
  });
});
