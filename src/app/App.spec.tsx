import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('inicio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('muestra el nombre de la app y si la API está conectada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok' })))),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Valora' })).toBeInTheDocument();
    expect(await screen.findByText('API conectada')).toBeInTheDocument();
  });

  it('la navegación principal lleva a cada sección y marca en la que está', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok' })))),
    );
    window.history.pushState({}, '', '/mapa');

    render(<App />);

    const nav = within(screen.getByRole('navigation', { name: 'Principal' }));
    for (const name of ['Inicio', 'Mapa', 'Registrar precio', 'Canasta', 'Yo']) {
      expect(nav.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(nav.getByRole('link', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });
});
