import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../test/fakeApi';
import { App } from './App';

const rice = {
  id: '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d',
  name: 'Arroz blanco',
  category: { code: 'grains-groceries', name: 'Granos y abarrotes' },
  presentations: [
    { id: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b', quantity: 500, unit: 'g', packCount: 1 },
  ],
};

describe('inicio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('el inicio pregunta qué vas a comprar y busca; el resultado lleva al detalle', async () => {
    stubApi({
      'GET /v1/products': { status: 200, body: { items: [rice] } },
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
    });

    render(<App />);
    expect(screen.getByRole('heading', { name: '¿Qué vas a comprar hoy?' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar producto' }), {
      target: { value: 'arroz' },
    });
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.click(await screen.findByRole('link', { name: /Arroz blanco/ }));

    expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/productos/${rice.id}`);
  });

  it('la navegación principal lleva a cada sección y marca en la que está', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok' })))),
    );
    window.history.pushState({}, '', '/mapa');

    render(<App />);

    const nav = within(screen.getByRole('navigation', { name: 'Principal' }));
    for (const name of ['Inicio', 'Mapa', 'Registrar precio', 'Yo']) {
      expect(nav.getByRole('link', { name })).toBeInTheDocument();
    }
    // La canasta (#31) no la pide ningún RF: vuelve si el equipo decide construirla.
    expect(nav.queryByRole('link', { name: 'Canasta' })).not.toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('la pestaña Yo muestra la cuenta de quien entró', async () => {
    stubApi({
      'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
    });
    window.history.pushState({}, '', '/yo');

    render(<App />);

    expect(await screen.findByText('Entraste como reportante.')).toBeInTheDocument();
  });
});
