import { mkdirSync, writeFileSync } from 'node:fs';
import { type Browser, expect, test } from '@playwright/test';
import {
  myReports,
  newAccount,
  plausiblePrice,
  register,
  signIn,
  someProducts,
  someStores,
  type Product,
  type Store,
} from './support/api';
import {
  chooseFirstPresentation,
  chooseStoreByName,
  expectHeading,
  sendPrice,
} from './support/screens';

// EC-07 / PR-08 (ADR-010): sin señal se guardan 50 reportes; al volver la señal se envían todos,
// sin duplicados y con p95 de confirmación de 60 s o menos. Como el backend acepta 20 reportes por
// hora por cuenta (RF-012), los 50 los hacen tres personas: 17, 17 y 16 (decisión de la usuaria).
const SHARES = [17, 17, 16];
const P95_LIMIT_MS = 60_000;

interface Outcome {
  sent: number;
  received: number;
  unique: number;
  confirmationsMs: number[];
}

async function oneReporter(
  browser: Browser,
  count: number,
  products: Product[],
  prices: number[],
  store: Store,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const account = newAccount('Reportera Sin Señal');
  await register(page.request, account);
  await signIn(page.request, account);

  // La app instalada (service worker) controla la página: así carga sin señal.
  await page.goto('/');
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // Con señal, cada producto se abre una vez: queda en la caché del catálogo (#26).
  for (const product of products) {
    await page.goto(`/registrar?producto=${product.id}`);
    await expectHeading(page, product.name);
  }

  // Se corta la señal y se registran los precios, uno tras otro, en la misma tienda.
  const [first, ...rest] = products;
  if (!first) throw new Error('Sin productos');
  await page.goto(`/registrar?producto=${first.id}`);
  await chooseFirstPresentation(page);
  await chooseStoreByName(page, store);
  await context.setOffline(true);
  await sendPrice(page, prices[0] ?? 0);
  await expectHeading(page, 'Guardado en tu teléfono');
  for (const [index, product] of rest.entries()) {
    await page.goto(`/registrar?producto=${product.id}`);
    await expectHeading(page, product.name);
    // La tienda de la vez anterior ya viene elegida.
    await expect(page.getByRole('radio', { name: store.name, exact: true })).toBeChecked();
    await chooseFirstPresentation(page);
    await sendPrice(page, prices[index + 1] ?? 0);
    await expectHeading(page, 'Guardado en tu teléfono');
  }

  // Vuelve la señal: la cola envía sola. Se mide cuándo aparece cada reporte en «Mis aportes».
  const back = Date.now();
  await context.setOffline(false);
  const firstSeen = new Map<string, number>();
  while (firstSeen.size < count && Date.now() - back < 2 * P95_LIMIT_MS) {
    for (const report of await myReports(page.request)) {
      if (!firstSeen.has(report.reportId)) firstSeen.set(report.reportId, Date.now() - back);
    }
    await page.waitForTimeout(250);
  }
  const reports = await myReports(page.request);
  await context.close();
  return {
    sent: count,
    received: reports.length,
    unique: new Set(reports.map(({ productName }) => productName)).size,
    confirmationsMs: [...firstSeen.values()],
  } satisfies Outcome;
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
};

test('EC-07: 50 reportes sin señal se envían todos al volver la señal, sin duplicados', async ({
  browser,
  request,
}) => {
  test.setTimeout(900_000);
  const total = SHARES.reduce((sum, share) => sum + share, 0);
  const products = await someProducts(request, Math.max(...SHARES));
  const stores = await someStores(request, SHARES.length);
  // Un precio verosímil por producto (ADR-030): la app pide confirmar uno atípico y, sin señal, el
  // reporte no se enviaría. Se calculan con señal, antes de cortarla.
  const prices = await Promise.all(
    products.map(async (product) => {
      const presentationId = product.presentations[0]?.id;
      if (!presentationId) throw new Error('Sin presentaciones en la semilla');
      return plausiblePrice(request, product.id, presentationId);
    }),
  );

  const outcomes: Outcome[] = [];
  for (const [index, share] of SHARES.entries()) {
    const store = stores[index];
    if (!store) throw new Error('Sin tiendas');
    outcomes.push(
      await oneReporter(browser, share, products.slice(0, share), prices.slice(0, share), store),
    );
  }

  const confirmations = outcomes.flatMap(({ confirmationsMs }) => confirmationsMs);
  const result = {
    escenario: 'EC-07 / PR-08',
    fecha: new Date().toISOString(),
    reportesGuardadosSinSenal: total,
    reportesRecibidos: outcomes.reduce((sum, { received }) => sum + received, 0),
    duplicados: outcomes.reduce((sum, { received, unique }) => sum + (received - unique), 0),
    p95ConfirmacionMs: percentile(confirmations, 95),
    maximoConfirmacionMs: Math.max(...confirmations),
    porPersona: outcomes,
  };
  // Evidencia para docs/ (la CI la guarda como artefacto).
  mkdirSync('e2e-results', { recursive: true });
  writeFileSync('e2e-results/ec-07.json', JSON.stringify(result, null, 2));

  expect(result.reportesRecibidos).toBe(total);
  expect(result.duplicados).toBe(0);
  expect(confirmations).toHaveLength(total);
  expect(result.p95ConfirmacionMs).toBeLessThanOrEqual(P95_LIMIT_MS);
});
