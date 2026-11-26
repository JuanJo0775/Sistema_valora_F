import { fireEvent, render, screen, within } from '@testing-library/react';
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

  // Un cero que no es verdad engaña: mientras no hay respuesta, la campana no dice cuántos hay.
  it('sin respuesta todavía no muestra ningún número', () => {
    renderBell({ kind: 'moderador', counts: undefined });

    const bell = screen.getByRole('button', { name: 'Avisos' });
    expect(bell).not.toHaveTextContent(/\d/);
  });

  it('con todo al día no muestra número y lo dice', () => {
    renderBell({
      kind: 'moderador',
      counts: { precios: 0, tiendas: 0, productos: 0, comercios: 0 },
    });

    const bell = screen.getByRole('button', { name: 'Avisos: nada pendiente' });
    expect(bell).not.toHaveTextContent(/\d/);
  });

  it('con un solo aviso habla en singular', () => {
    renderBell({
      kind: 'moderador',
      counts: { precios: 1, tiendas: 0, productos: 0, comercios: 0 },
    });

    expect(screen.getByRole('button', { name: 'Avisos: 1 pendiente' })).toBeInTheDocument();
  });

  it('quien no es moderador ni comercio no ve la campana', () => {
    renderBell({ kind: 'ninguno' });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('al tocarla lista las cuatro colas con su número y lleva a cada pestaña del panel', () => {
    renderBell({ kind: 'moderador', counts: COUNTS });
    const bell = screen.getByRole('button', { name: 'Avisos: 3 pendientes' });
    expect(bell).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(bell);

    expect(bell).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: 'Pendientes de moderación' });
    expect(
      within(panel)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Precios2', '/moderacion?vista=precios'],
      ['Tiendas0', '/moderacion?vista=tiendas'],
      ['Productos0', '/moderacion?vista=productos'],
      ['Comercios1', '/moderacion?vista=comercios'],
    ]);
  });
});
