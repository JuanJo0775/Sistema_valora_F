import { type APIRequestContext, expect } from '@playwright/test';

// Ayudas para preparar datos por la API pública (/v1, por el mismo proxy de la app). Lo que se
// prueba se hace por la pantalla; esto solo deja lista la escena.

export interface Account {
  email: string;
  password: string;
  displayName: string;
}

let counter = 0;

// Una cuenta nueva en cada corrida: el correo lleva la hora para no chocar con corridas anteriores.
export function newAccount(name: string): Account {
  counter += 1;
  return {
    email: `e2e-${String(Date.now())}-${String(counter)}@valora.test`,
    password: 'una clave larga de prueba',
    displayName: name,
  };
}

export async function register(request: APIRequestContext, account: Account) {
  const response = await request.post('/v1/auth/register', {
    data: { ...account, acceptedPolicyVersion: '2026-11' },
  });
  expect(response.status(), await response.text()).toBe(201);
}

export async function signIn(request: APIRequestContext, account: Account) {
  const response = await request.post('/v1/auth/login', {
    data: { email: account.email, password: account.password },
  });
  expect(response.status(), await response.text()).toBe(204);
}

async function csrf(request: APIRequestContext): Promise<string> {
  const response = await request.get('/v1/auth/session');
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { csrfToken: string }).csrfToken;
}

export interface Product {
  id: string;
  name: string;
  presentations: { id: string }[];
}

const TERMS = [
  'arroz',
  'leche',
  'aceite',
  'azucar',
  'cafe',
  'huevo',
  'panela',
  'frijol',
  'lenteja',
  'pasta',
  'sal',
  'harina',
  'atun',
  'jabon',
  'papel',
  'galleta',
  'chocolate',
  'queso',
  'avena',
  'gaseosa',
  'detergente',
  'crema',
];

// Productos distintos del catálogo de la semilla, buscando por palabras comunes.
export async function someProducts(request: APIRequestContext, wanted: number) {
  const found = new Map<string, Product>();
  for (const term of TERMS) {
    if (found.size >= wanted) break;
    const response = await request.get(`/v1/products?q=${term}`);
    expect(response.ok()).toBe(true);
    for (const product of ((await response.json()) as { items: Product[] }).items) {
      if (product.presentations.length > 0) found.set(product.id, product);
    }
  }
  const products = [...found.values()].slice(0, wanted);
  expect(products.length, 'la semilla trae productos suficientes').toBe(wanted);
  return products;
}

export interface Store {
  id: string;
  name: string;
}

// Tiendas de Armenia con nombre único (para elegirlas por su nombre en la pantalla), al azar para
// no repetir la misma tienda en corridas seguidas contra la misma base.
export async function someStores(request: APIRequestContext, wanted: number) {
  const response = await request.get('/v1/establishments?municipality=armenia&limit=50');
  expect(response.ok()).toBe(true);
  const stores = ((await response.json()) as { items: Store[] }).items;
  const names = stores.map(({ name }) => name);
  const unique = stores.filter(
    ({ name }) => names.indexOf(name) === names.lastIndexOf(name) && name.length >= 3,
  );
  const shuffled = [...unique].sort(() => Math.random() - 0.5);
  expect(shuffled.length).toBeGreaterThanOrEqual(wanted);
  return shuffled.slice(0, wanted);
}

export interface Offer {
  reportId: string;
  presentationId: string;
  priceCop: number;
  freshness: string;
  reliability: string;
  isCheapest: boolean;
  establishment: { id: string };
}

// La comparación de un producto en Armenia, tal como la lee la app.
export async function comparisonOf(request: APIRequestContext, productId: string) {
  const response = await request.get(`/v1/products/${productId}/comparison?municipality=armenia`);
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { results: Offer[] }).results;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

// ADR-030: el backend manda a revisión un precio con menos del 40 % o más del 250 % de la mediana de
// las otras tiendas, y un precio fijo cae fuera de rango según lo que traiga la semilla. El precio de
// prueba sale de la referencia real: entre 0,9 y 1,2 veces la mediana de los vigentes de esa
// presentación (con una variación al azar para no repetir el mismo precio entre corridas). Sin
// referencia el servidor solo aplica el piso de $100, y cualquier precio de este orden pasa.
export async function plausiblePrice(
  request: APIRequestContext,
  productId: string,
  presentationId: string,
): Promise<number> {
  const prices = (await comparisonOf(request, productId))
    .filter(
      (offer) =>
        offer.presentationId === presentationId &&
        offer.freshness === 'vigente' &&
        offer.reliability !== 'en_revision',
    )
    .map(({ priceCop }) => priceCop);
  if (prices.length === 0) return 3000 + Math.floor(Math.random() * 900);
  return Math.max(150, Math.round(median(prices) * (0.9 + Math.random() * 0.3)));
}

// Un producto y una presentación con referencia suficiente (al menos 5 tiendas con precio vigente,
// más que las 3 que pide la regla) y un precio de $1.000 o más: así el 15 % de su mediana supera el
// piso de $100 y cae bajo el 40 % que el servidor sospecha.
export async function productWithReference(request: APIRequestContext) {
  for (const product of await someProducts(request, 25)) {
    const presentationId = product.presentations[0]?.id;
    if (!presentationId) continue;
    const prices = (await comparisonOf(request, product.id))
      .filter(
        (offer) =>
          offer.presentationId === presentationId &&
          offer.freshness === 'vigente' &&
          offer.reliability !== 'en_revision',
      )
      .map(({ priceCop }) => priceCop);
    if (prices.length >= 5 && median(prices) >= 1000) return { product, presentationId };
  }
  throw new Error('La semilla no trae un producto con referencia suficiente');
}

// Un precio claramente atípico para esa presentación: el 15 % de la mediana (bajo el 40 % que el
// servidor sospecha) y nunca por debajo del piso de $100, que se rechaza.
export async function atypicalPrice(
  request: APIRequestContext,
  productId: string,
  presentationId: string,
): Promise<number> {
  const normal = await plausiblePrice(request, productId, presentationId);
  return Math.max(120, Math.round(normal * 0.15) + Math.floor(Math.random() * 10));
}

// Un precio reportado por la API, con su clave de idempotencia (EC-07).
export async function reportPrice(
  request: APIRequestContext,
  {
    presentationId,
    establishmentId,
    priceCop,
  }: { presentationId: string; establishmentId: string; priceCop: number },
) {
  const response = await request.post('/v1/reports', {
    headers: { 'X-CSRF-Token': await csrf(request), 'Idempotency-Key': crypto.randomUUID() },
    data: {
      presentationId,
      establishmentId,
      priceCop,
      priceType: 'normal',
      observedAt: new Date().toISOString(),
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

export async function flagReport(request: APIRequestContext, reportId: string) {
  const response = await request.post(`/v1/reports/${reportId}/flag`, {
    headers: { 'X-CSRF-Token': await csrf(request) },
    data: { reason: 'precio_falso' },
  });
  expect(response.status(), await response.text()).toBeLessThan(300);
}

export interface MyReport {
  reportId: string;
  productName: string;
  establishmentName: string;
  priceCop: number;
  status: string;
}

export async function myReports(request: APIRequestContext): Promise<MyReport[]> {
  const response = await request.get('/v1/me/reports');
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { items: MyReport[] }).items;
}

// La cuenta moderadora la crea la CI (o la persona en local) con `identity:set-role` del backend.
export function moderator(): Account {
  const email = process.env['E2E_MODERATOR_EMAIL'];
  const password = process.env['E2E_MODERATOR_PASSWORD'];
  if (!email || !password) {
    throw new Error(
      'Faltan E2E_MODERATOR_EMAIL y E2E_MODERATOR_PASSWORD (la cuenta moderadora de las pruebas).',
    );
  }
  return { email, password, displayName: 'Moderación' };
}
