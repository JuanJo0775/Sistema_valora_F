import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BasketProvider } from '../features/basket/BasketProvider';
import { PlanPage } from '../features/plan/PlanPage';
import type { PlanDraft } from '../features/plan/savedPlan';

// Fixtures y montaje compartidos por las pruebas del plan de compra.

export const RICE = '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d';
export const MILK = '4a2d3b75-6d2f-4c9b-8e72-1b8c2f3d4e5f';
export const SALT = '5b3e4c86-7e30-4dac-9f83-2c9d3a4e5f60';

// Producto de la canasta.
export const item = (
  productId: string,
  productName: string,
  presentationId: string,
  quantity = 1,
) => ({
  productId,
  productName,
  presentationId,
  presentationLabel: '1 und',
  quantity,
  bought: false,
});
export const rice = item(RICE, 'Arroz blanco', 'arroz-500g', 2);
export const milk = item(MILK, 'Leche entera', 'leche-1l');
export const salt = item(SALT, 'Sal', 'sal-1kg');

// Tienda tal como la devuelve la API.
export const shop = (id: string, name: string, lat: number, distanceM?: number) => ({
  id,
  name,
  type: 'barrio',
  address: `Calle ${name} 1`,
  lat,
  lng: -75.6811,
  municipality: 'armenia',
  ...(distanceM === undefined ? {} : { distanceM }),
});

// Precio de un producto en una tienda.
export const offer = (
  store: ReturnType<typeof shop>,
  presentationId: string,
  priceCop: number,
) => ({
  establishment: store,
  reportId: crypto.randomUUID(),
  presentationId,
  priceCop,
  unitPrice: { valueCop: priceCop, per: 'und' },
  source: 'comunidad',
  freshness: 'vigente',
  reliability: 'alta',
  confirmations: 1,
  isCheapest: false,
  observedAt: new Date().toISOString(),
});

// Ruta falsa de la comparación de un producto.
export const comparisonOf = (productId: string, ...results: ReturnType<typeof offer>[]) => ({
  [`GET /v1/products/${productId}/comparison`]: {
    status: 200,
    body: {
      productId,
      criteria: { sort: 'unit_price', municipality: 'armenia' },
      results,
      promotions: [],
    },
  },
});

// Tiendas A y B: con distancia (la persona dio su ubicación) y sin ella.
export const near = {
  a: shop('a', 'Tienda A', 4.5339, 400),
  b: shop('b', 'Tienda B', 4.5439, 1100),
};
export const far = { a: shop('a', 'Tienda A', 4.5339), b: shop('b', 'Tienda B', 4.5439) };

// Monta la pantalla del plan con esa canasta guardada.
export const renderPlan = (...items: ReturnType<typeof item>[]) => {
  localStorage.setItem('valora:canasta', JSON.stringify(items));
  return render(
    <BasketProvider>
      <MemoryRouter>
        <PlanPage />
      </MemoryRouter>
    </BasketProvider>,
  );
};

// La persona da su ubicación: el navegador responde con ese punto.
export const locateAt = (latitude: number, longitude: number) => {
  localStorage.setItem('valora:donde', 'ubicacion');
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void) => {
        ok({ coords: { latitude, longitude } });
      },
    },
  });
};

type DraftLine = PlanDraft['lines'][number];

// Línea de un plan: el número identifica producto y presentación (p1/pr1).
const line = (
  n: number,
  productName: string,
  presentationLabel: string,
  quantity: number,
  price: Pick<DraftLine, 'storeId' | 'priceCop' | 'source' | 'observedAt'>,
): DraftLine => ({
  productId: `p${String(n)}`,
  productName,
  presentationId: `pr${String(n)}`,
  presentationLabel,
  quantity,
  freshness: 'vigente',
  ...price,
});

// Borrador de plan completo: 2 tiendas (una con domicilio de $5.000) y 3 líneas, la última sin precio.
export const planDraft = (over: Partial<PlanDraft> = {}): PlanDraft => ({
  area: { kind: 'ubicacion', radiusKm: 1.5, lat: 4.5339, lng: -75.6811 },
  stores: [
    {
      id: 's1',
      name: 'D1 Calle 50',
      type: 'descuento',
      address: 'Cl. 50 # 14-20',
      lat: 4.53,
      lng: -75.68,
      municipality: 'armenia',
      distanceM: 812,
      delivery: { feeCop: 5000 },
    },
    {
      id: 's2',
      name: 'Tienda Don Pepe',
      type: 'barrio',
      lat: 4.54,
      lng: -75.69,
      municipality: 'armenia',
      distanceM: 400,
      delivery: null,
    },
  ],
  lines: [
    line(1, 'Arroz blanco', 'Diana · 500 g', 2, {
      storeId: 's1',
      priceCop: 2190,
      source: 'siembra',
      observedAt: '2026-11-16T15:00:00Z',
    }),
    line(2, 'Aceite', '1 L', 1, {
      storeId: 's2',
      priceCop: 9000,
      source: 'comunidad',
      observedAt: '2026-11-15T15:00:00Z',
    }),
    line(3, 'Sal marina', '500 g', 1, {
      storeId: null,
      priceCop: null,
      source: 'comunidad',
      observedAt: null,
    }),
  ],
  summary: {
    stores: 2,
    productsCop: 13380,
    baselineCop: 15000,
    travel: {
      extraKm: 1.4,
      extra: true,
      minutes: 19,
      costCop: null,
      assumptions: { detour: 1.3, kmh: 4.5, mode: 'none' },
    },
    deliveryCop: 5000,
    netCop: -3380,
    missing: 1,
  },
  ...over,
});
