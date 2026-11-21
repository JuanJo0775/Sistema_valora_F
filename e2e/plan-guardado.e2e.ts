import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

// Plan de compra guardado (Corte 3): (A) la pantalla abre sin conexión y (B) al imprimir solo queda
// el contenido del plan. Todos los datos son inventados; la prueba no depende del backend.
const EVIDENCE_DIR = process.env['E2E_EVIDENCE_DIR'] ?? join(process.cwd(), '..', 'e2e-evidencia');

const PLAN_ID = '00000000-aaaa-4bbb-8ccc-000000000001';
const STORAGE_KEY = 'valora:planes';
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

function line(
  productId: string,
  productName: string,
  presentationId: string,
  presentationLabel: string,
  quantity: number,
  storeId: string | null,
  priceCop: number | null,
  observedDaysAgo: number | null,
) {
  return {
    productId,
    productName,
    presentationId,
    presentationLabel,
    quantity,
    storeId,
    priceCop,
    source: 'comunidad',
    freshness: 'vigente',
    observedAt: observedDaysAgo === null ? null : daysAgo(observedDaysAgo),
    bought: false,
  };
}

const plan = {
  v: 1,
  id: PLAN_ID,
  savedAt: now.toISOString(),
  area: { kind: 'municipio', municipality: 'armenia' },
  stores: [
    {
      id: 'tienda-prueba-1',
      name: 'Tienda La Esquina de Prueba',
      type: 'barrio',
      address: 'Calle 1 # 2-3, Barrio Inventado',
      lat: 4.5339,
      lng: -75.6811,
      municipality: 'armenia',
      delivery: null,
    },
    {
      id: 'tienda-prueba-2',
      name: 'Minimercado El Ahorro de Prueba',
      type: 'descuento',
      address: 'Carrera 9 # 8-7, Barrio Ficticio',
      lat: 4.5401,
      lng: -75.6702,
      municipality: 'armenia',
      delivery: { feeCop: 5000 },
    },
  ],
  lines: [
    line('arroz', 'Arroz blanco', 'arroz-500g', '500 g', 2, 'tienda-prueba-1', 3200, 1),
    line('leche', 'Leche entera', 'leche-1l', '1 L', 1, 'tienda-prueba-1', 4100, 2),
    line('aceite', 'Aceite vegetal', 'aceite-1l', '1 L', 1, 'tienda-prueba-2', 11900, 3),
    line('panela', 'Panela', 'panela-500g', '500 g', 3, 'tienda-prueba-2', 2800, 0),
    line('sal', 'Sal marina', 'sal-1kg', '1 kg', 1, null, null, null),
  ],
  summary: {
    stores: 2,
    productsCop: 36_700,
    baselineCop: null,
    travel: {
      extraKm: 1.2,
      extra: true,
      minutes: 16,
      costCop: null,
      assumptions: { detour: 1.3, kmh: 4.5, mode: 'none' },
    },
    deliveryCop: 5000,
    netCop: 1800,
    missing: 1,
  },
};

// La app instalada (service worker) controla la página, como en sin-conexion.e2e.ts.
async function activateServiceWorker(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function seedPlan(page: Page) {
  await page.evaluate(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [STORAGE_KEY, JSON.stringify({ v: 1, plans: [plan] })] as const,
  );
}

const planUrl = (id: string) => `/canasta/plan/${id}`;

async function goOffline(context: BrowserContext) {
  await context.setOffline(true);
}

test('un plan guardado se abre sin conexión', async ({ page, context }) => {
  await activateServiceWorker(page);
  await seedPlan(page);
  await goOffline(context);

  // Navegación real por URL completa: depende del respaldo de rutas del service worker.
  await page.goto(planUrl(PLAN_ID));

  await expect(
    page.getByRole('heading', { level: 1, name: 'Plan de compra guardado' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Tienda La Esquina de Prueba' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Minimercado El Ahorro de Prueba' }),
  ).toBeVisible();
  await expect(page.getByText('Calle 1 # 2-3, Barrio Inventado')).toBeVisible();
  await expect(page.getByText('Carrera 9 # 8-7, Barrio Ficticio')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Cómo llegar a Tienda La Esquina de Prueba' }),
  ).toBeVisible();
  await expect(page.getByText(/Precio del \d+ \S+/).first()).toBeVisible();
  await expect(page.getByText('2 × Arroz blanco')).toBeVisible();

  // Sin precio vigente y totales.
  await expect(page.getByRole('heading', { name: 'Sin precio vigente cerca' })).toBeVisible();
  await expect(page.getByText('Sal marina')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Totales' })).toBeVisible();
  await expect(
    page.getByText(/Tarifa de domicilio que escribiste \(estimado\): \$\s?5\.000/),
  ).toBeVisible();
  await expect(page.getByText(/en productos/)).toContainText(/36\.700/);
  await expect(page.getByText(/Domicilio \(estimado\): \$\s?5\.000/)).toBeVisible();

  // Sin red no se puede volver a armar con precios de hoy.
  await expect(
    page.getByRole('button', { name: 'Armar de nuevo con precios de hoy' }),
  ).toBeDisabled();
  await expect(page.getByText('Necesitas conexión para actualizar')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Armar de nuevo con precios de hoy' })).toHaveCount(
    0,
  );

  // «Comprado» funciona sin red y persiste al recargar (también sin red).
  const bought = page.getByRole('checkbox', { name: 'Comprado: Arroz blanco' });
  await expect(bought).not.toBeChecked();
  await bought.check();
  await expect(bought).toBeChecked();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Comprado: Arroz blanco' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Comprado: Leche entera' })).not.toBeChecked();
});

test('un plan que no existe muestra el estado vacío sin conexión', async ({ page, context }) => {
  await activateServiceWorker(page);
  await seedPlan(page);
  await goOffline(context);

  await page.goto(planUrl('no-existe-0000'));

  await expect(page.getByRole('heading', { name: 'No encontramos este plan' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver a mi canasta' })).toBeVisible();
});

test('al imprimir solo queda el contenido del plan', async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.goto('/');
  await seedPlan(page);
  await page.goto(planUrl(PLAN_ID));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Plan de compra guardado' }),
  ).toBeVisible();

  // En pantalla lo que se va a esconder sí está visible: así la prueba no pasa en vacío.
  const hidden = [
    page.getByRole('button', { name: 'Compartir' }),
    page.getByRole('button', { name: 'Descargar' }),
    page.getByRole('button', { name: 'Imprimir' }),
    page.getByRole('button', { name: 'Borrar este plan' }),
    page.getByRole('link', { name: 'Armar de nuevo con precios de hoy' }),
    page.getByRole('link', { name: 'Cómo llegar a Tienda La Esquina de Prueba' }),
    page.getByRole('link', { name: 'Cómo llegar a Minimercado El Ahorro de Prueba' }),
  ];
  for (const locator of hidden) await expect(locator).toBeVisible();
  await expect(page.locator('header, nav').first()).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Aviso de cookies' })).toBeVisible();
  await page.screenshot({ path: join(EVIDENCE_DIR, 'plan-pantalla.png'), fullPage: true });

  await page
    .locator('section[aria-labelledby="sin-precio"]')
    .screenshot({ path: join(EVIDENCE_DIR, 'sin-precio-pantalla.png') });

  await page.emulateMedia({ media: 'print' });

  for (const locator of hidden) await expect(locator).toBeHidden();
  // Navegación y cabecera: ningún header/nav visible.
  for (const el of await page.locator('header, nav').all()) await expect(el).toBeHidden();
  await expect(page.locator('.saved-plans')).toBeHidden();
  await expect(page.locator('.cookie-notice')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Mis planes guardados' })).toHaveCount(0);

  // Visible: tiendas, productos con precio, totales y aviso del domicilio.
  for (const name of ['Tienda La Esquina de Prueba', 'Minimercado El Ahorro de Prueba']) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  await expect(page.getByText('2 × Arroz blanco')).toBeVisible();
  await expect(page.getByText('1 × Aceite vegetal')).toBeVisible();
  await expect(page.getByText(/Precio del \d+ \S+/).first()).toBeVisible();
  await expect(page.getByText(/Subtotal: \$\s?10.500/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Totales' })).toBeVisible();
  await expect(page.getByText(/en productos/)).toBeVisible();
  await expect(page.getByText(/Valora no hace pedidos ni domicilios/)).toBeVisible();

  await page.screenshot({ path: join(EVIDENCE_DIR, 'plan-impresion.png'), fullPage: true });
  const pdfPath = join(EVIDENCE_DIR, 'plan-impresion.pdf');
  writeFileSync(pdfPath, await page.pdf({ format: 'A4', printBackground: true }));

  // El texto del PDF va comprimido y con fuentes subconjunto: no se extrae con una aserción simple.
  // Se comprueba que el PDF existe y que la caja de cada tienda cabe en una página A4.
  expect(readFileSync(pdfPath).subarray(0, 5).toString()).toBe('%PDF-');
  const pageHeightPx = (297 / 25.4) * 96;
  const heights = await page
    .locator('.plan-store')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeLessThan(pageHeightPx);
});
