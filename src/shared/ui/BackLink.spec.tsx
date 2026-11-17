import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BackLink } from './BackLink';

function renderAt(entries: string[], index: number, label?: string) {
  const router = createMemoryRouter(
    [
      { path: '/mapa', element: <p>pantalla mapa</p> },
      { path: '/otra', element: <p>pantalla otra</p> },
      { path: '/tiendas/1', element: <BackLink fallback="/mapa" label={label} /> },
    ],
    { initialEntries: entries, initialIndex: index },
  );
  render(<RouterProvider router={router} />);
  return router;
}

// El enrutador de memoria no escribe window.history.state: se simula el del navegador.
function setHistoryIdx(idx: number | undefined) {
  window.history.replaceState(idx === undefined ? null : { idx }, '');
}

describe('BackLink', () => {
  it('con historial de la app vuelve a la pantalla anterior', () => {
    setHistoryIdx(1);
    const router = renderAt(['/otra', '/tiendas/1'], 1);

    fireEvent.click(screen.getByRole('link', { name: 'Volver' }));

    expect(router.state.location.pathname).toBe('/otra');
  });

  it('sin historial va a la ruta de respaldo', () => {
    setHistoryIdx(0);
    const router = renderAt(['/tiendas/1'], 0);

    fireEvent.click(screen.getByRole('link', { name: 'Volver' }));

    expect(router.state.location.pathname).toBe('/mapa');
    expect(screen.getByText('pantalla mapa')).toBeInTheDocument();
  });

  it('sin estado del navegador también usa el respaldo', () => {
    setHistoryIdx(undefined);
    const router = renderAt(['/otra', '/tiendas/1'], 1);

    fireEvent.click(screen.getByRole('link', { name: 'Volver' }));

    expect(router.state.location.pathname).toBe('/mapa');
  });

  it('tiene nombre accesible y apunta al respaldo', () => {
    setHistoryIdx(0);
    renderAt(['/tiendas/1'], 0, 'Mapa');

    const link = screen.getByRole('link', { name: 'Volver a Mapa' });
    expect(link).toHaveAttribute('href', '/mapa');
    expect(link).toHaveTextContent('Mapa');
  });
});
