import { expect, test } from '@playwright/test';
import {
  atypicalPrice,
  comparisonOf,
  myReports,
  newAccount,
  productWithReference,
  register,
  signIn,
  someStores,
} from './support/api';
import {
  chooseFirstPresentation,
  chooseStoreByName,
  expectHeading,
  pesos,
  sendPrice,
} from './support/screens';

// ADR-030 (EC-03): lo que el servidor hace con un precio fuera de lo razonable, visto desde la
// pantalla. Los demás E2E usan precios dentro de rango; estos dos prueban justo lo contrario.

// Una sola alta para los dos escenarios: el backend deja 10 altas por IP cada 15 minutos.
const account = newAccount('Ana Atípica');
test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ playwright }, testInfo) => {
  const context = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  await register(context, account);
  await context.dispose();
});

test('un precio atípico se confirma, queda «En revisión» y nunca es el más barato', async ({
  page,
}) => {
  const { product, presentationId } = await productWithReference(page.request);
  const [store] = await someStores(page.request, 1);
  if (!store) throw new Error('Sin tiendas');
  const price = await atypicalPrice(page.request, product.id, presentationId);
  await signIn(page.request, account);

  await page.goto(`/registrar?producto=${product.id}`);
  await expectHeading(page, product.name);
  await chooseFirstPresentation(page);
  await chooseStoreByName(page, store);
  await sendPrice(page, price);
  // La app pide confirmar un precio tan lejos de lo que ven las demás tiendas.
  await expect(page.getByRole('alertdialog')).toContainText('Revisa el precio');
  await page.getByRole('button', { name: 'Sí, ese es el precio' }).click();
  await expectHeading(page, 'Recibido');

  // Quien lo reportó lo ve en «Mis aportes», «En revisión» (llega con el repartidor de eventos).
  await page.goto('/mis-aportes');
  const mine = page
    .getByRole('listitem')
    .filter({ hasText: store.name })
    .filter({ hasText: pesos(price) });
  await expect(async () => {
    await page.reload();
    await expect(mine).toContainText('En revisión', { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  const report = (await myReports(page.request)).find(({ priceCop }) => priceCop === price);
  expect(report?.status).toBe('en_revision');

  // En la comparación nunca es el titular: o no aparece, o aparece «en revisión» y sin ser el más barato.
  const offers = (await comparisonOf(page.request, product.id)).filter(
    (offer) => offer.reportId === report?.reportId,
  );
  for (const offer of offers) {
    expect(offer.reliability).toBe('en_revision');
    expect(offer.isCheapest).toBe(false);
  }
  const cheapest = (await comparisonOf(page.request, product.id)).filter(
    (offer) => offer.isCheapest,
  );
  expect(cheapest.map(({ priceCop }) => priceCop)).not.toContain(price);
});

test('un precio menor de $100 se rechaza con el mensaje de la pantalla y no se envía', async ({
  page,
  request,
}) => {
  const { product } = await productWithReference(request);
  const [store] = await someStores(request, 1);
  if (!store) throw new Error('Sin tiendas');
  await signIn(page.request, account);

  await page.goto(`/registrar?producto=${product.id}`);
  await expectHeading(page, product.name);
  await chooseFirstPresentation(page);
  await chooseStoreByName(page, store);
  await sendPrice(page, 12);
  await expect(page.getByRole('alert')).toContainText('Ningún producto cuesta menos de $100');
  await expect(page.getByRole('heading', { name: 'Recibido', exact: true })).toHaveCount(0);
  expect(
    (await myReports(page.request)).some(({ priceCop }) => priceCop === 12),
    'el precio de $12 no llegó al servidor',
  ).toBe(false);
});
