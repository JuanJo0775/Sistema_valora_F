import type { Page } from '@playwright/test';

// Escena inventada con datos parecidos a los reales (nombres largos, imágenes, promoción, discrepancia,
// 7 tiendas, 16 productos) para Inicio, producto, mapa y tienda. Sin backend: /v1, las teselas y las
// fotos se responden con page.route. Nada de datos reales. La canasta usa `planFake.ts`.

const NOW = Date.now();
const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(NOW - days * DAY).toISOString();

// Un elemento que debe existir: evita los `!` y falla claro si el dato inventado no está.
function at<T>(list: readonly T[], index: number): T {
  const found = list[index];
  if (found === undefined) throw new Error(`Falta el dato ${String(index)} de la escena falsa`);
  return found;
}

const CATEGORIES = [
  { code: 'granos', name: 'Granos y cereales' },
  { code: 'lacteos', name: 'Lácteos y huevos' },
  { code: 'aceites', name: 'Aceites y grasas' },
  { code: 'aseo', name: 'Aseo del hogar' },
  { code: 'bebidas', name: 'Bebidas' },
  { code: 'carnes', name: 'Carnes y pescados' },
  { code: 'frutas', name: 'Frutas y verduras' },
  { code: 'panaderia', name: 'Panadería y galletas' },
  { code: 'snacks', name: 'Dulces y snacks' },
];

// [nombre, marca, categoría, cantidad, unidad]
const NAMES: [string, string | undefined, string, number, string][] = [
  [
    'Arroz blanco Premium Extra Largo Grano Seleccionado Bolsa Familiar',
    'Del Campo Quindiano',
    'granos',
    5,
    'kg',
  ],
  ['Arroz', 'Diana', 'granos', 1, 'kg'],
  ['Leche entera UHT', 'Alquería', 'lacteos', 1, 'l'],
  ['Aceite vegetal de girasol 100 % puro sin colesterol', 'Premier', 'aceites', 3, 'l'],
  ['Huevos AA', undefined, 'lacteos', 30, 'und'],
  ['Frijol cargamanto rojo seleccionado', 'La Fragua', 'granos', 500, 'g'],
  ['Azúcar blanca refinada', 'Manuelita', 'granos', 2, 'kg'],
  ['Lentejas', 'Zenú', 'granos', 500, 'g'],
  [
    'Detergente en polvo multiusos con limón y bicarbonato para ropa blanca y de color',
    'Fab',
    'aseo',
    2,
    'kg',
  ],
  ['Papel higiénico doble hoja', 'Familia', 'aseo', 12, 'und'],
  ['Gaseosa cola', 'Postobón', 'bebidas', 2.5, 'l'],
  ['Agua en botella sin gas', undefined, 'bebidas', 600, 'ml'],
  ['Queso campesino', 'Colanta', 'lacteos', 500, 'g'],
  ['Sal marina refinada yodada', 'Refisal', 'granos', 1, 'kg'],
  ['Atún en aceite lomitos', 'Van Camps', 'aceites', 160, 'g'],
  ['Café molido tostado clásico de origen Quindío', 'Juan Valdez', 'bebidas', 500, 'g'],
];

export const RICH_PRODUCTS = NAMES.map(([name, brand, category, quantity, unit], i) => ({
  id: `p-${String(i + 1)}`,
  name,
  ...(brand ? { brand } : {}),
  category: at(
    CATEGORIES.filter(({ code }) => code === category),
    0,
  ),
  ...(i % 4 === 0
    ? {
        image: {
          url: `https://img.valora.test/p${String(i)}.svg`,
          source: 'open_food_facts',
          attribution: 'Open Food Facts',
        },
      }
    : {}),
  presentations: [
    { id: `p-${String(i + 1)}-a`, quantity, unit, packCount: 1 },
    ...(i % 3 === 0
      ? [{ id: `p-${String(i + 1)}-b`, quantity: quantity * 2, unit, packCount: 1 }]
      : []),
  ],
}));

type RichProduct = (typeof RICH_PRODUCTS)[number];
const productAt = (index: number): RichProduct => at(RICH_PRODUCTS, index);
const firstPresentation = (product: RichProduct) => at(product.presentations, 0);
const labelOf = (product: RichProduct) => {
  const { quantity, unit } = firstPresentation(product);
  return `${product.name} · ${String(quantity)} ${unit}`;
};

// [id, nombre, tipo, dirección, barrio, lat, lng, precios]
const STORES: [string, string, string, string | undefined, string, number, number, number][] = [
  [
    'e-1',
    'Supermercado Cooperativo Los Cafeteros del Quindío Sede Norte',
    'supermercado',
    'Carrera 14 Bis # 50 Norte - 120, Barrio Los Fundadores',
    'Los Fundadores',
    4.5339,
    -75.6811,
    14,
  ],
  ['e-2', 'Tienda Don Pepe', 'barrio', 'Calle 12 # 3-4', 'Centro', 4.5439, -75.6911, 9],
  ['e-3', 'Mercado La Esquina', 'minimercado', undefined, 'La Patria', 4.5239, -75.6711, 6],
  [
    'e-4',
    'D1 Avenida Bolívar',
    'descuento',
    'Avenida Bolívar # 19N-45',
    'Bolívar',
    4.5539,
    -75.6611,
    12,
  ],
  [
    'e-5',
    'Minimercado Doña Rosa',
    'minimercado',
    'Calle 21 # 14-30, Barrio Brasilia',
    'Brasilia',
    4.5139,
    -75.6811,
    4,
  ],
  ['e-6', 'Tienda La Bendición', 'barrio', 'Carrera 18 # 7-12', 'El Silencio', 4.5639, -75.7011, 3],
  [
    'e-7',
    'Éxito Unicentro Armenia',
    'supermercado',
    'Avenida Centenario # 3-100, Centro Comercial Unicentro',
    'Centenario',
    4.5039,
    -75.6511,
    15,
  ],
];

const estab = (index: number, withDistance = false) => {
  const [id, name, type, address, neighborhood, lat, lng] = at(STORES, index);
  return {
    id,
    name,
    type,
    ...(address ? { address } : {}),
    neighborhood,
    lat,
    lng,
    municipality: 'armenia',
    ...(withDistance ? { distanceM: 350 + index * 420 } : {}),
  };
};
const estabWithCount = (index: number, withDistance = false) => ({
  ...estab(index, withDistance),
  priceCount: at(STORES, index)[7],
});

const FRESHNESS = [
  'vigente',
  'vigente',
  'por_confirmar',
  'desactualizado',
  'vigente',
  'por_confirmar',
  'vigente',
] as const;
const AGE_DAYS = [0.3, 1, 6, 22, 2, 9, 0.6];
const RELIABILITY = ['alta', 'media', 'baja', 'en_revision'] as const;
const BASE_PRICES = [
  1200, 4200, 12_900, 15_000, 18_000, 3200, 8800, 2400, 22_900, 19_900, 6900, 1700, 14_500, 1500,
  5900,
];

// El último producto no tiene precios; el 3.º (índice 2) tiene promoción y discrepancia.
export const NO_PRICES_PRODUCT = 'p-16';
export const PROMO_PRODUCT = 'p-3';

function offersOf(index: number) {
  const product = productAt(index);
  if (index === RICH_PRODUCTS.length - 1) return [];
  const count = index % 3 === 0 ? 7 : index % 3 === 1 ? 5 : 3;
  const base = at(BASE_PRICES, index % BASE_PRICES.length);
  const unit = firstPresentation(product).unit;
  return Array.from({ length: count }, (_, k) => {
    const price = Math.round((base * (1 + k * 0.07)) / 50) * 50;
    return {
      establishment: estab(k, true),
      reportId: `r-${String(index)}-${String(k)}`,
      presentationId: firstPresentation(product).id,
      priceCop: price,
      unitPrice: { valueCop: Math.round(price / 5), per: unit === 'und' ? 'und' : '100g' },
      source: k === 1 ? 'oficial' : k === 6 ? 'siembra' : 'comunidad',
      freshness: at(FRESHNESS, k),
      reliability: at(RELIABILITY, k % 4),
      isCheapest: k === 0,
      confirmations: k + 1,
      observedAt: daysAgo(at(AGE_DAYS, k)),
      ...(index === 2 && k === 2
        ? {
            discrepancy: {
              officialPriceCop: price - 300,
              reportedPriceCop: price,
              reports: 3,
              since: daysAgo(4),
            },
          }
        : {}),
    };
  });
}

function comparisonOf(index: number) {
  const results = offersOf(index);
  const product = productAt(index);
  return {
    productId: product.id,
    criteria: { sort: 'unit_price', municipality: 'armenia' },
    results,
    promotions:
      index === 2 && results.length > 0
        ? [
            {
              id: 'promo-1',
              establishment: estab(3, true),
              presentationId: firstPresentation(product).id,
              type: 'descuento_porcentual',
              percent: 15,
              conditions: { maxPerCustomer: 3, whileStocksLast: true, paymentMethod: 'tarjeta' },
              validFrom: daysAgo(1),
              validUntil: new Date(NOW + 5 * DAY).toISOString(),
              officialPriceCop: 4600,
              promotedPriceCop: 3910,
            },
          ]
        : [],
    ...(index === 0
      ? {
          wholesaleReference: {
            source: 'SIPSA (DANE)',
            productName: 'Arroz de segunda',
            market: 'Armenia, Mercar',
            pricePerKgCop: 3150,
            periodStart: '2026-11-10',
            periodEnd: '2026-11-16',
            url: 'https://www.dane.gov.co/sipsa',
          },
        }
      : {}),
    ...(results.length > 1 ? { savingsPercent: 18 } : {}),
  };
}

function featuredOf(index: number) {
  const product = productAt(index);
  const offers = offersOf(index);
  const first = offers[0];
  const last = offers.at(-1);
  if (!first || !last) return null;
  const side = (offer: (typeof offers)[number]) => ({
    presentationId: offer.presentationId,
    label: labelOf(product),
    priceCop: offer.priceCop,
    source: offer.source,
    unitPrice: offer.unitPrice,
    establishment: {
      id: offer.establishment.id,
      name: offer.establishment.name,
      address: offer.establishment.address,
      neighborhood: offer.establishment.neighborhood,
      distanceM: offer.establishment.distanceM,
    },
  });
  return {
    productId: product.id,
    name: product.name,
    ...(product.brand ? { brand: product.brand } : {}),
    category: product.category,
    ...(product.image ? { image: product.image } : {}),
    storeCount: offers.length,
    cheapest: side(first),
    ...(offers.length > 1 ? { priciest: side(last), savingsPercent: 18 } : {}),
  };
}
const FEATURED = RICH_PRODUCTS.flatMap((_, i) => featuredOf(i) ?? []);

function historyOf(index: number) {
  const product = productAt(index);
  const day = (offset: number) => new Date(NOW - offset * DAY).toISOString().slice(0, 10);
  return {
    productId: product.id,
    from: day(70),
    to: day(0),
    presentations: product.presentations.map((presentation, j) => ({
      presentationId: presentation.id,
      label: `${String(presentation.quantity)} ${presentation.unit}`,
      points: Array.from({ length: 28 }, (_, k) => {
        const base = (index === 0 ? 12_900 : 4200) * (j + 1);
        const wave = Math.round((Math.sin(k / 3) * 300 + k * 12) / 50) * 50;
        return {
          date: day(70 - k * 2.5),
          minPriceCop: base + wave,
          avgPriceCop: base + wave + 250,
          reports: 1 + (k % 5),
          source: 'reportado',
        };
      }),
    })),
  };
}

// Las tiendas con número par traen teléfono y horario semanal (los objetivos pequeños de la ficha).
function storePricesOf(index: number) {
  const [id, name, type, address, neighborhood, lat, lng, count] = at(STORES, index);
  const hours = { opens: '07:00', closes: '20:00' };
  const prices = RICH_PRODUCTS.slice(0, count).map((product, k) => {
    const price = offersOf(k)[0]?.priceCop ?? 5000;
    return {
      productId: product.id,
      presentationId: firstPresentation(product).id,
      productName: labelOf(product),
      reportId: `rs-${String(k)}`,
      priceCop: price,
      unitPrice: { valueCop: Math.round(price / 5), per: 'und' },
      source: k % 5 === 1 ? 'oficial' : 'comunidad',
      freshness: at(FRESHNESS, k % 7),
      reliability: 'alta',
      confirmations: 1 + (k % 4),
      observedAt: daysAgo(at(AGE_DAYS, k % 7)),
    };
  });
  return {
    establishment: {
      id,
      name,
      type,
      ...(address ? { address } : {}),
      neighborhood,
      lat,
      lng,
      municipality: 'armenia',
      ...(index % 2 === 0
        ? {
            openingHours: {
              lunes: hours,
              martes: hours,
              miercoles: hours,
              jueves: hours,
              viernes: hours,
              sabado: { opens: '08:00', closes: '18:00' },
              domingo: null,
            },
            phone: '3105550142',
          }
        : {}),
    },
    prices,
  };
}

const SVG = (size: number, fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}"><rect width="${String(size)}" height="${String(size)}" fill="${fill}"/></svg>`;

// Responde el catálogo, las tiendas y sus precios; sin sesión (401) y sin teselas ni fotos de verdad.
export async function richApi(page: Page) {
  await page.route('https://img.valora.test/**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: SVG(200, '#d9c9a3') }),
  );
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: SVG(256, '#e8e4d8') }),
  );
  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/v1/, '');
    const query = url.searchParams;
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (path === '/categories') return json({ items: CATEGORIES });
    if (path === '/featured-products') {
      const category = query.get('category');
      const all = category ? FEATURED.filter((f) => f.category.code === category) : FEATURED;
      const offset = Number(query.get('offset') ?? 0);
      const limit = Number(query.get('limit') ?? 5);
      return json({
        criteria: { municipality: 'armenia', sort: 'store_count' },
        storesWithPrices: STORES.length,
        total: all.length,
        hasMore: offset + limit < all.length,
        items: all.slice(offset, offset + limit),
      });
    }
    if (path === '/products') return json({ items: RICH_PRODUCTS.slice(0, 8) });
    const product = /^\/products\/([^/]+)(\/comparison|\/history)?$/.exec(path);
    if (product) {
      const index = RICH_PRODUCTS.findIndex(({ id }) => id === product[1]);
      if (index < 0) return json({ code: 'NOT_FOUND', message: 'No existe.' }, 404);
      if (product[2] === '/comparison') return json(comparisonOf(index));
      if (product[2] === '/history') return json(historyOf(index));
      return json(productAt(index));
    }
    if (path === '/establishments') return json({ items: STORES.map((_, i) => estabWithCount(i)) });
    if (path === '/establishments/nearby')
      return json({ items: STORES.map((_, i) => estabWithCount(i, true)) });
    const prices = /^\/establishments\/([^/]+)\/prices$/.exec(path);
    if (prices) {
      const index = STORES.findIndex(([id]) => id === prices[1]);
      return index < 0
        ? json({ code: 'NOT_FOUND', message: 'No existe.' }, 404)
        : json(storePricesOf(index));
    }
    return json({ code: 'UNAUTHORIZED', message: 'Se requiere sesión.' }, 401);
  });
}

// Lo mínimo para que una prueba no vea el aviso de cookies ni la invitación a instalar.
export const quietStorage = (page: Page) =>
  page.addInitScript(() => {
    localStorage.setItem('valora:aviso-cookies', '1');
    localStorage.setItem('valora:instalar-oculto', '1');
  });
