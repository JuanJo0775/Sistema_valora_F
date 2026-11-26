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

  // Un panel que no se puede cerrar con el teclado atrapa a quien no usa el mouse (WCAG 2.2).
  it('Escape cierra el panel y devuelve el foco a la campana', () => {
    renderBell({ kind: 'moderador', counts: COUNTS });
    const bell = screen.getByRole('button', { name: 'Avisos: 3 pendientes' });
    fireEvent.click(bell);
    const row = screen.getAllByRole('link')[0] as HTMLElement;
    row.focus();

    fireEvent.keyDown(row, { key: 'Escape' });

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
    expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  it('tocar fuera del panel lo cierra', () => {
    renderBell({ kind: 'moderador', counts: COUNTS });
    fireEvent.click(screen.getByRole('button', { name: 'Avisos: 3 pendientes' }));

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('elegir una cola cierra el panel y lleva a esa pestaña', () => {
    renderBell({ kind: 'moderador', counts: COUNTS });
    fireEvent.click(screen.getByRole('button', { name: 'Avisos: 3 pendientes' }));

    fireEvent.click(screen.getByRole('link', { name: /^Precios/ }));

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});

// ADR-043: el comercio ve en la campana los mismos avisos que en su pantalla (vencimiento y discrepancia).
describe('campana de avisos del comercio (ADR-043)', () => {
  const ALERTS = [
    {
      kind: 'vence_pronto' as const,
      presentationId: 'a1b2c3d4-0000-4000-8000-000000000001',
      productName: 'Arroz Diana · 500 g',
      message: 'Tu precio oficial de Arroz Diana · 500 g vence mañana: reconfírmalo.',
    },
    {
      kind: 'discrepancia' as const,
      presentationId: 'a1b2c3d4-0000-4000-8000-000000000002',
      productName: 'Pasta Doria · 500 g',
      message: 'Dos reportes dicen $4.200 y tu precio oficial es $4.500.',
    },
  ];

  it('cuenta sus avisos y los muestra con su mensaje, llevando a su pantalla', () => {
    renderBell({ kind: 'comercio', alerts: ALERTS });

    fireEvent.click(screen.getByRole('button', { name: 'Avisos: 2 pendientes' }));

    const panel = screen.getByRole('region', { name: 'Tus avisos' });
    expect(
      within(panel)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      [ALERTS[0]?.message, '/comercios'],
      [ALERTS[1]?.message, '/comercios'],
    ]);
  });
});
