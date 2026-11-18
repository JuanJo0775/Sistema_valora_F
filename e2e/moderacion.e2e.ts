import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  comparisonOf,
  flagReport,
  moderator,
  myReports,
  newAccount,
  plausiblePrice,
  register,
  reportPrice,
  signIn,
  someProducts,
  someStores,
  type Product,
  type Store,
} from './support/api';
import { choose, eventually, pesos } from './support/screens';

// RF-012 y RF-013 (ADR-030): una persona marca un precio como dudoso; mientras un moderador no lo
// decide, deja de ser el precio vigente y el «Más barato» (queda «En revisión»); si lo descarta, el
// precio se retira; si lo aprueba, vuelve a ser vigente.

interface Scene {
  product: Product;
  store: Store;
  price: number;
  reportId: string;
}

// El backend deja 10 altas por IP cada 15 minutos y la CI usa el mismo IP para todos los E2E: las dos
// cuentas (quien reporta y quien marca) se crean una vez y las usan los dos escenarios.
let reporter: APIRequestContext;
let flagger: APIRequestContext;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ playwright }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  reporter = await playwright.request.newContext({ baseURL });
  const reporterAccount = newAccount('Quien Reporta');
  await register(reporter, reporterAccount);
  await signIn(reporter, reporterAccount);
  flagger = await playwright.request.newContext({ baseURL });
  const flaggerAccount = newAccount('Quien Marca');
  await register(flagger, flaggerAccount);
  await signIn(flagger, flaggerAccount);
});
test.afterAll(async () => {
  await reporter.dispose();
  await flagger.dispose();
});

const shownReport = async (page: Page, productId: string, reportId: string) =>
  (await comparisonOf(page.request, productId)).find((offer) => offer.reportId === reportId);

// Deja un precio verosímil ya visible en la comparación y lo marca con otra cuenta. Quien reporta y
// quien marca usan su propia sesión (sin la pantalla).
async function flaggedPrice(page: Page): Promise<Scene> {
  const [product] = await someProducts(page.request, 1);
  const [store] = await someStores(page.request, 1);
  const presentationId = product?.presentations[0]?.id;
  if (!product || !store || !presentationId) throw new Error('Sin datos de la semilla');
  // Dentro del rango de la regla de plausibilidad: si no, el reporte nacería «En revisión».
  const price = await plausiblePrice(page.request, product.id, presentationId);

  await reportPrice(reporter, { presentationId, establishmentId: store.id, priceCop: price });
  // La comparación y «Mis aportes» se arman con el repartidor de eventos (ADR-015): pueden tardar.
  let reportId = '';
  await expect(async () => {
    const found = (await myReports(reporter)).find(({ priceCop }) => priceCop === price);
    expect(found, 'el reporte aparece en «Mis aportes»').toBeDefined();
    reportId = found?.reportId ?? '';
  }).toPass({ timeout: 30_000 });
  // Solo se saca del titular lo que es el precio mostrado: primero debe estar vigente.
  await expect(async () => {
    const shown = await shownReport(page, product.id, reportId);
    expect(shown?.priceCop, 'el precio ya se ve en la comparación').toBe(price);
    expect(shown?.reliability).not.toBe('en_revision');
  }).toPass({ timeout: 30_000 });

  await flagReport(flagger, reportId);

  // Marcado, deja de ser el precio vigente: queda «En revisión» y no es el más barato.
  await expect(async () => {
    const shown = await shownReport(page, product.id, reportId);
    expect(shown?.reliability).toBe('en_revision');
    expect(shown?.isCheapest).toBe(false);
  }).toPass({ timeout: 30_000 });

  return { product, store, price, reportId };
}

async function openQueueItem(page: Page, { store, price }: Scene) {
  await signIn(page.request, moderator());
  await page.goto('/moderacion');
  const item = page
    .getByRole('listitem')
    .filter({ hasText: store.name })
    .filter({ hasText: pesos(price) });
  // La marca llega a la cola por el repartidor de eventos (ADR-015): puede tardar unos segundos.
  await expect(async () => {
    await page.reload();
    await expect(item).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  return item;
}

async function decide(page: Page, item: ReturnType<Page['getByRole']>, option: string) {
  await choose(item.getByRole('radio', { name: option }));
  await item
    .getByLabel('Motivo de la decisión')
    .fill('Decisión de la prueba de extremo a extremo.');
  await item.getByRole('button', { name: 'Registrar decisión' }).click();
  await expect(page.getByRole('status')).toContainText('Decisión registrada');
}

test('un precio marcado deja de ser el titular y un moderador que lo descarta lo retira', async ({
  page,
}) => {
  const scene = await flaggedPrice(page);
  const { product, price, reportId } = scene;

  // En la pantalla, el precio marcado ya no compite: va entre los precios «en revisión».
  await page.goto(`/productos/${product.id}`);
  const stores = page.getByRole('region', { name: 'Todas las tiendas' });
  await eventually(page, async () => {
    const row = stores.getByRole('listitem').filter({ hasText: pesos(price) });
    await expect(row.first()).toContainText('En revisión', { timeout: 2_000 });
  });

  // El moderador lo sigue viendo en su cola y lo descarta con su motivo.
  const item = await openQueueItem(page, scene);
  await decide(page, item, 'Descartar');

  // Descartado, se retira: ya no está en la comparación.
  await expect(async () => {
    expect(await shownReport(page, product.id, reportId)).toBeUndefined();
  }).toPass({ timeout: 30_000 });
  await page.goto(`/productos/${product.id}`);
  await eventually(page, async () => {
    await expect(page.getByRole('region', { name: 'Todas las tiendas' })).not.toContainText(
      pesos(price),
      { timeout: 2_000 },
    );
  });
});

test('un moderador que aprueba un precio marcado lo devuelve a vigente', async ({ page }) => {
  const scene = await flaggedPrice(page);
  const { product, price, reportId } = scene;

  const item = await openQueueItem(page, scene);
  await decide(page, item, 'Aprobar');

  await expect(async () => {
    const shown = await shownReport(page, product.id, reportId);
    expect(shown?.reliability, 'aprobado, vuelve a competir').not.toBe('en_revision');
  }).toPass({ timeout: 30_000 });
  await page.goto(`/productos/${product.id}`);
  const stores = page.getByRole('region', { name: 'Todas las tiendas' });
  await eventually(page, async () => {
    const row = stores.getByRole('listitem').filter({ hasText: pesos(price) });
    await expect(row.first()).toBeVisible({ timeout: 2_000 });
    await expect(row.first()).not.toContainText('En revisión', { timeout: 2_000 });
  });
});
