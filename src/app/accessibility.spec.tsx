import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations, violationsOf } from '../test/axe';
import { type FakeReply, NO_SESSION, sessionAs, stubApi } from '../test/fakeApi';
import { App } from './App';

// #28 (WCAG 2.2 AA): cada pantalla de los flujos críticos (buscar, comparar, registrar, sesión,
// canasta y moderación) sin fallas graves de accesibilidad según axe.

const RICE = '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d';
const PRESENTATION = '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b';
const STORE = '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d';

const rice = {
  id: RICE,
  name: 'Arroz blanco',
  brand: 'Diana',
  category: { code: 'granos', name: 'Granos' },
  presentations: [{ id: PRESENTATION, quantity: 500, unit: 'g', packCount: 1 }],
};

const store = {
  id: STORE,
  name: 'Ara',
  type: 'descuento',
  lat: 4.5339,
  lng: -75.6811,
  municipality: 'armenia',
};

const ok = (body: unknown): FakeReply => ({ status: 200, body });

const routes: Record<string, FakeReply> = {
  'GET /v1/auth/session': sessionAs('reportante'),
  'GET /v1/categories': ok({ items: [rice.category] }),
  'GET /v1/featured-products': ok({
    criteria: { municipality: 'armenia', sort: 'store_count' },
    storesWithPrices: 1,
    items: [
      {
        productId: RICE,
        name: 'Arroz blanco',
        category: rice.category,
        storeCount: 1,
        cheapest: {
          presentationId: PRESENTATION,
          label: 'Arroz blanco · 500 g',
          priceCop: 2000,
          unitPrice: { valueCop: 400, per: '100g' },
          establishment: { id: STORE, name: 'Ara' },
        },
      },
    ],
  }),
  [`GET /v1/products/${RICE}`]: ok(rice),
  [`GET /v1/products/${RICE}/comparison`]: ok({
    productId: RICE,
    criteria: { sort: 'unit_price', municipality: 'armenia' },
    results: [
      {
        establishment: store,
        reportId: '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918',
        presentationId: PRESENTATION,
        priceCop: 2000,
        unitPrice: { valueCop: 400, per: '100g' },
        source: 'comunidad',
        freshness: 'vigente',
        reliability: 'alta',
        confirmations: 1,
        isCheapest: true,
        observedAt: new Date().toISOString(),
      },
    ],
    promotions: [],
  }),
  [`GET /v1/products/${RICE}/history`]: ok({
    from: '2026-10-18',
    to: '2026-11-16',
    presentations: [],
  }),
  'GET /v1/establishments': ok({ items: [{ ...store, priceCount: 1 }] }),
  'GET /v1/me/reports': ok({ items: [] }),
  'GET /v1/moderation/queue': ok({ items: [] }),
};

const visit = (path: string, extra: Record<string, FakeReply> = {}) => {
  stubApi({ ...routes, ...extra });
  window.history.pushState({}, '', path);
  return render(<App />);
};

describe('accesibilidad de los flujos críticos (axe, WCAG 2.2 AA)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('el Inicio, con la canasta básica de hoy', async () => {
    visit('/');
    await screen.findByRole('heading', { name: 'Arroz blanco' });

    expect(await seriousViolations()).toEqual([]);
    // Los títulos van en orden (h1, luego h2): así se navega por títulos con lector de pantalla.
    expect(await violationsOf('heading-order')).toEqual([]);
  });

  it('el detalle del producto, con todas las tiendas', async () => {
    visit(`/productos/${RICE}`);
    await screen.findByRole('heading', { name: 'Ara' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('registrar un precio', async () => {
    visit(`/registrar?producto=${RICE}`);
    await screen.findByRole('heading', { name: 'Arroz blanco' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('iniciar sesión', async () => {
    visit('/entrar', { 'GET /v1/auth/session': NO_SESSION });
    await screen.findByRole('button', { name: 'Entrar' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('crear cuenta', async () => {
    visit('/crear-cuenta', { 'GET /v1/auth/session': NO_SESSION });
    await screen.findByRole('button', { name: 'Crear cuenta' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('olvidé mi contraseña', async () => {
    visit('/olvide-contrasena', { 'GET /v1/auth/session': NO_SESSION });
    await screen.findByRole('button', { name: 'Enviarme el enlace' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('restablecer la contraseña', async () => {
    visit('/restablecer-contrasena?token=abc', { 'GET /v1/auth/session': NO_SESSION });
    await screen.findByRole('button', { name: 'Guardar contraseña' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('la canasta con un producto', async () => {
    localStorage.setItem(
      'valora:canasta',
      JSON.stringify([
        {
          productId: RICE,
          productName: 'Arroz blanco',
          presentationId: PRESENTATION,
          presentationLabel: '500 g',
          quantity: 1,
          bought: false,
        },
      ]),
    );
    visit('/canasta');
    await screen.findByRole('heading', { name: 'Mi canasta' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('el plan de compra, con su reparto en tiendas', async () => {
    localStorage.setItem(
      'valora:canasta',
      JSON.stringify([
        {
          productId: RICE,
          productName: 'Arroz blanco',
          presentationId: PRESENTATION,
          presentationLabel: '500 g',
          quantity: 1,
          bought: false,
        },
      ]),
    );
    visit('/canasta/plan');
    await screen.findByRole('heading', { name: '1 tienda' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('un plan de compra guardado', async () => {
    localStorage.setItem(
      'valora:planes',
      JSON.stringify({
        v: 1,
        plans: [
          {
            v: 1,
            id: 'plan-1',
            savedAt: new Date().toISOString(),
            area: { kind: 'municipio', municipality: 'armenia' },
            stores: [
              {
                id: STORE,
                name: 'Ara',
                type: 'descuento',
                lat: 4.5339,
                lng: -75.6811,
                municipality: 'armenia',
                delivery: null,
              },
            ],
            lines: [
              {
                productId: RICE,
                productName: 'Arroz blanco',
                presentationId: PRESENTATION,
                presentationLabel: '500 g',
                quantity: 1,
                storeId: STORE,
                priceCop: 2000,
                source: 'comunidad',
                freshness: 'vigente',
                observedAt: new Date().toISOString(),
                bought: false,
              },
            ],
            summary: {
              stores: 1,
              productsCop: 2000,
              baselineCop: null,
              travel: null,
              deliveryCop: 0,
              netCop: null,
              missing: 0,
            },
          },
        ],
      }),
    );
    visit('/canasta/plan/plan-1');
    await screen.findByRole('heading', { name: 'Ara' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('el mapa de tiendas', async () => {
    visit('/mapa');
    await screen.findByRole('heading', { name: 'Ara' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('Yo', async () => {
    visit('/yo');
    await screen.findByRole('heading', { name: 'Hola' });

    expect(await seriousViolations()).toEqual([]);
  });

  it('el panel del moderador', async () => {
    visit('/moderacion', { 'GET /v1/auth/session': sessionAs('moderador') });
    await screen.findByRole('heading', { name: 'No hay precios en revisión' });

    expect(await seriousViolations()).toEqual([]);
  });
});
