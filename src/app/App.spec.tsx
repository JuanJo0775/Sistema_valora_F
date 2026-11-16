import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, sessionAs, stubApi } from '../test/fakeApi';
import { openReportQueue } from '../pwa/reportQueue';
import { App } from './App';

// Leaflet necesita un navegador de verdad para dibujar el mapa.
vi.mock('../features/stores/StoreMap', () => ({ StoreMap: () => null }));

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
    fireEvent.submit(screen.getByRole('search', { name: 'Buscar producto' }));
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
    for (const name of ['Inicio', 'Mapa', 'Registrar precio', 'Canasta', 'Yo']) {
      expect(nav.getByRole('link', { name })).toBeInTheDocument();
    }
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
    fireEvent.click(screen.getByRole('link', { name: '1 reporte por enviar' }));
    expect(
      await screen.findByRole('heading', { name: 'Reportes en este teléfono' }),
    ).toBeInTheDocument();
  });

  it('sin red, quien entró como reportante la última vez puede abrir «Registrar precio»', async () => {
    localStorage.setItem('valora:ultimo-rol', 'reportante');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    window.history.pushState({}, '', '/registrar');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '¿Qué precio viste?' })).toBeInTheDocument();
    localStorage.clear();
  });

  // #48: en escritorio el buscador va en la barra superior, en todas las pantallas.
  it('el buscador de la barra superior lleva a los resultados desde cualquier pantalla', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'GET /v1/products': { status: 200, body: { items: [rice] } },
    });
    window.history.pushState({}, '', '/yo');
    render(<App />);
    const header = within(screen.getByRole('banner'));

    fireEvent.change(header.getByRole('searchbox', { name: 'Buscar en Valora' }), {
      target: { value: 'arroz' },
    });
    fireEvent.submit(header.getByRole('search'));

    expect(await screen.findByRole('link', { name: /Arroz blanco/ })).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe('/?q=arroz');
  });

  // #31: la canasta vuelve como lista de compras.
  it('la pestaña Canasta dice cuántos productos faltan por comprar y lleva a la lista', async () => {
    localStorage.setItem(
      'valora:canasta',
      JSON.stringify([
        {
          productId: rice.id,
          productName: 'Arroz blanco',
          presentationId: 'arroz-500g',
          presentationLabel: '500 g',
          quantity: 2,
          bought: false,
        },
        {
          productId: rice.id,
          productName: 'Arroz blanco',
          presentationId: 'arroz-1kg',
          presentationLabel: '1 kg',
          quantity: 1,
          bought: true,
        },
      ]),
    );
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });
    render(<App />);
    const nav = within(screen.getByRole('navigation', { name: 'Principal' }));

    fireEvent.click(nav.getByRole('link', { name: 'Canasta, 1 por comprar' }));

    expect(await screen.findByRole('heading', { name: 'Mi canasta' })).toBeInTheDocument();
    localStorage.clear();
  });

  it('desde el detalle, «Historial» abre los precios de los últimos 30 días', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/history`]: {
        status: 200,
        body: { from: '2026-10-18', to: '2026-11-16', presentations: [] },
      },
    });
    window.history.pushState({}, '', `/productos/${rice.id}`);
    render(<App />);

    fireEvent.click(await screen.findByRole('link', { name: 'Historial' }));

    expect(
      await screen.findByRole('heading', { name: 'Historial de precios · Arroz blanco' }),
    ).toBeInTheDocument();
  });

  it('la pestaña Mapa muestra las tiendas y cada una lleva a su página', async () => {
    const store = {
      id: '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
      name: 'Ara',
      type: 'descuento',
      lat: 4.5339,
      lng: -75.6811,
      municipality: 'armenia',
    };
    stubApi({
      'GET /v1/establishments': { status: 200, body: { items: [store] } },
      [`GET /v1/establishments/${store.id}/prices`]: {
        status: 200,
        body: { establishment: store, prices: [] },
      },
    });
    window.history.pushState({}, '', '/mapa');
    render(<App />);

    fireEvent.click(await screen.findByRole('link', { name: 'Ver precios de Ara' }));

    expect(await screen.findByText('Todavía no hay precios en esta tienda.')).toBeInTheDocument();
  });
});
