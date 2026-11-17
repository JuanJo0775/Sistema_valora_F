import { expect, request as api, test } from '@playwright/test';
import {
  flagReport,
  moderator,
  myReports,
  newAccount,
  register,
  reportPrice,
  signIn,
  someProducts,
  someStores,
} from './support/api';
import { choose, pesos } from './support/screens';

// RF-012 y RF-013: una persona marca un precio como dudoso, un moderador lo descarta y el precio
// deja de verse en la comparación.
test('un moderador descarta un precio marcado y deja de verse', async ({ page, baseURL }) => {
  const [product] = await someProducts(page.request, 1);
  const [store] = await someStores(page.request, 1);
  const presentationId = product?.presentations[0]?.id;
  if (!product || !store || !presentationId) throw new Error('Sin datos de la semilla');
  const price = 7000 + Math.floor(Math.random() * 900);

  // Quien reporta y quien marca usan su propia sesión (sin la pantalla).
  const reporter = await api.newContext({ baseURL });
  const reporterAccount = newAccount('Quien Reporta');
  await register(reporter, reporterAccount);
  await signIn(reporter, reporterAccount);
  await reportPrice(reporter, { presentationId, establishmentId: store.id, priceCop: price });
  // «Mis aportes» se arma con el repartidor de eventos (ADR-015): puede tardar un momento.
  let reportId = '';
  await expect(async () => {
    const found = (await myReports(reporter)).find(({ priceCop }) => priceCop === price);
    expect(found, 'el reporte aparece en «Mis aportes»').toBeDefined();
    reportId = found?.reportId ?? '';
  }).toPass({ timeout: 30_000 });

  const flagger = await api.newContext({ baseURL });
  const flaggerAccount = newAccount('Quien Marca');
  await register(flagger, flaggerAccount);
  await signIn(flagger, flaggerAccount);
  await flagReport(flagger, reportId);

  await page.goto(`/productos/${product.id}`);
  const stores = page.getByRole('region', { name: 'Todas las tiendas' });
  await expect(stores).toContainText(pesos(price));

  // El moderador lo encuentra en la cola y lo descarta con su motivo.
  await signIn(page.request, moderator());
  await page.goto('/moderacion');
  const item = page
    .getByRole('listitem')
    .filter({ hasText: store.name })
    .filter({
      hasText: pesos(price),
    });
  // La marca llega a la cola por el repartidor de eventos (ADR-015): puede tardar unos segundos.
  await expect(async () => {
    await page.reload();
    await expect(item).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await choose(item.getByRole('radio', { name: 'Descartar' }));
  await item.getByLabel('Motivo de la decisión').fill('Precio que no corresponde a la tienda.');
  await item.getByRole('button', { name: 'Registrar decisión' }).click();
  await expect(page.getByRole('status')).toContainText('Decisión registrada');

  await page.goto(`/productos/${product.id}`);
  await expect(page.getByRole('region', { name: 'Todas las tiendas' })).not.toContainText(
    pesos(price),
  );
  await reporter.dispose();
  await flagger.dispose();
});
