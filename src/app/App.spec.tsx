import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, sessionAs, stubApi } from '../test/fakeApi';
import { openReportQueue } from '../pwa/reportQueue';
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
      'GET /v1/auth/session': sessionAs('reportante'),
    });
    window.history.pushState({}, '', '/yo');

    render(<App />);

    expect(await screen.findByText('Entraste como reportante.')).toBeInTheDocument();
  });

  it('desde Yo, «Iniciar sesión» lleva al formulario para entrar', async () => {
    stubApi({
      'GET /v1/auth/session': NO_SESSION,
    });
    window.history.pushState({}, '', '/yo');
    render(<App />);

    fireEvent.click(await screen.findByRole('link', { name: 'Iniciar sesión' }));

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('desde Yo, «Crear cuenta» lleva al formulario de registro', async () => {
    stubApi({
      'GET /v1/auth/session': NO_SESSION,
    });
    window.history.pushState({}, '', '/yo');
    render(<App />);

    fireEvent.click(await screen.findByRole('link', { name: 'Crear cuenta' }));

    expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
  });

  it('«Registrar precio» sin sesión pide entrar', async () => {
    stubApi({
      'GET /v1/auth/session': NO_SESSION,
    });
    window.history.pushState({}, '', '/registrar');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(window.location.search).toBe('?volver=%2Fregistrar');
  });

  it('la moderación es solo para moderadores', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
    });
    window.history.pushState({}, '', '/moderacion');

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Esta sección es para cuentas de moderador' }),
    ).toBeInTheDocument();
  });

  it('un reportante que toca «Registrar precio» empieza buscando el producto', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });
    window.history.pushState({}, '', '/registrar');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '¿Qué precio viste?' })).toBeInTheDocument();
  });

  it('desde el detalle, «Comparar precios» abre la comparación en Armenia', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: {
        status: 200,
        body: {
          productId: rice.id,
          criteria: { sort: 'unit_price', municipality: 'armenia' },
          results: [],
          promotions: [],
        },
      },
    });
    window.history.pushState({}, '', `/productos/${rice.id}`);
    render(<App />);

    fireEvent.click(await screen.findByRole('link', { name: 'Comparar precios' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Todavía nadie ha reportado este producto en Armenia',
      }),
    ).toBeInTheDocument();
  });

  it('si quedan reportes por enviar, un aviso lo dice y lleva a verlos', async () => {
    await (
      await openReportQueue()
    ).add({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      body: {
        presentationId: rice.presentations[0]?.id ?? '',
        establishmentId: '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
        priceCop: 2500,
        priceType: 'normal',
        observedAt: new Date().toISOString(),
      },
      label: { product: 'Arroz blanco · 500 g', store: 'Tienda Don Pepe' },
    });
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/reports': {
        status: 503,
        body: { code: 'REQUEST_ERROR', message: 'No disponible.' },
      },
    });

    render(<App />);

    expect(await screen.findByRole('link', { name: '1 reporte por enviar' })).toHaveAttribute(
      'href',
      '/pendientes',
    );
  });
});
