import type { Page } from '@playwright/test';

// Escena inventada para las pantallas del plan de compra: sin backend, todo por page.route y
// localStorage. Nada de datos reales.

const LONG_STORE = 'Supermercado Cooperativo Los Cafeteros del Quindio Sede Norte Etapa Dos';
const LONG_ADDRESS = 'Carrera 14 Bis # 50 Norte - 120, Barrio Los Fundadores, Armenia, Quindio';
const LONG_PRODUCT = 'Arroz blanco premium extra largo grano seleccionado bolsa familiar';

interface Store {
  id: string;
  name: string;
  lat: number;
  address?: string;
}

const STORES: Store[] = [
  { id: 'e-a', name: LONG_STORE, lat: 4.5339, address: LONG_ADDRESS },
  { id: 'e-b', name: 'Tienda Don Pepe', lat: 4.5439, address: 'Calle 12 # 3-4' },
  { id: 'e-c', name: 'Mercado La Esquina', lat: 4.5539 },
];

const shop = (s: Store) => ({
  id: s.id,
  name: s.name,
  type: 'barrio',
  ...(s.address ? { address: s.address } : {}),
  lat: s.lat,
  lng: -75.6811,
  municipality: 'armenia',
});

// Producto de la canasta: precio en cada tienda (A, B, C); null = esa tienda no lo tiene.
interface Product {
  id: string;
  name: string;
  prices: (number | null)[];
}

export const PRODUCTS: Product[] = [
  { id: 'p-1', name: LONG_PRODUCT, prices: [1_234_567, 1_300_000, 1_500_000] },
  { id: 'p-2', name: 'Leche entera', prices: [4200, 3900, 4500] },
  { id: 'p-3', name: 'Aceite de girasol', prices: [15_000, 16_000, 12_000] },
  { id: 'p-4', name: 'Producto que nadie vende', prices: [null, null, null] },
];

export const basketOf = (products: Product[]) =>
  products.map((p) => ({
    productId: p.id,
    productName: p.name,
    presentationId: `${p.id}-pr`,
    presentationLabel: '1 und',
    quantity: 2,
    bought: false,
  }));

const offersOf = (p: Product) =>
  p.prices.flatMap((price, i) => {
    const store = STORES[i];
    if (price === null || !store) return [];
    return [
      {
        establishment: shop(store),
        reportId: `${p.id}-${store.id}`,
        presentationId: `${p.id}-pr`,
        priceCop: price,
        unitPrice: { valueCop: price, per: 'und' },
        source: 'comunidad',
        freshness: 'vigente',
        reliability: 'alta',
        confirmations: 1,
        isCheapest: false,
        observedAt: new Date().toISOString(),
      },
    ];
  });

// Responde la comparación de cada producto; `mode` simula un fallo o que no hay precios.
// `seen` recoge cada solicitud que llega a /v1 (para contarlas en las pruebas).
export async function fakeApi(page: Page, mode: 'ok' | 'empty' | 'error' = 'ok', seen: URL[] = []) {
  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url());
    seen.push(url);
    const { pathname } = url;
    const match = /\/products\/([^/]+)\/comparison$/.exec(pathname);
    if (!match) return route.fulfill({ status: 401, json: { title: 'Sin sesión' } });
    if (mode === 'error') return route.fulfill({ status: 500, json: { title: 'Falla' } });
    const product = PRODUCTS.find((p) => p.id === match[1]);
    const results = mode === 'empty' || !product ? [] : offersOf(product);
    return route.fulfill({
      json: {
        productId: match[1],
        criteria: { sort: 'unit_price', municipality: 'armenia' },
        results,
        promotions: [],
      },
    });
  });
}

// Deja un valor en localStorage antes de que cargue la página.
export const seed = (page: Page, key: string, value: unknown) =>
  page.addInitScript(
    ([k, v]) => {
      localStorage.setItem(String(k), typeof v === 'string' ? v : JSON.stringify(v));
    },
    [key, value],
  );

// Plan guardado con tiendas y líneas largas (el caso más ancho) y una línea sin precio.
export function savedPlan(id: string, stores = 5) {
  const list = Array.from({ length: stores }, (_, i) => ({
    id: `s${String(i)}`,
    name: i === 0 ? LONG_STORE : `Tienda número ${String(i)}`,
    type: 'barrio',
    address: i === 0 ? LONG_ADDRESS : 'Calle 1 # 2-3',
    lat: 4.53 + i / 100,
    lng: -75.68,
    municipality: 'armenia',
    delivery: i === 1 ? { feeCop: 5000 } : null,
  }));
  const line = (n: string, name: string, price: number | null, storeId: string | null) => ({
    productId: n,
    productName: name,
    presentationId: `${n}-pr`,
    presentationLabel: '1 und',
    quantity: 2,
    storeId,
    priceCop: price,
    source: 'comunidad',
    freshness: 'vigente',
    observedAt: price === null ? null : '2026-11-15T15:00:00Z',
    bought: false,
  });
  const lines = [
    ...list.map((s, i) =>
      line(
        `q${String(i)}`,
        i === 0 ? LONG_PRODUCT : `Producto ${String(i)}`,
        i === 0 ? 1_234_567 : 9000,
        s.id,
      ),
    ),
    line('q-x', 'Sal marina sin precio cerca', null, null),
  ];
  return {
    v: 1,
    id,
    savedAt: new Date().toISOString(),
    area: { kind: 'municipio', municipality: 'armenia' },
    stores: list,
    lines,
    summary: {
      stores,
      productsCop: 2_505_134,
      baselineCop: 2_600_000,
      travel: {
        extraKm: 3.4,
        extra: true,
        minutes: 45,
        costCop: 3000,
        assumptions: { detour: 1.3, kmh: 4.5, mode: 'fare', fareCop: 1500 },
      },
      deliveryCop: 5000,
      netCop: 123_456,
      missing: 1,
    },
  };
}
