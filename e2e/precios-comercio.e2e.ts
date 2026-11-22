import { expect, test } from '@playwright/test';
import { newAccount, register, signIn, someProducts } from './support/api';

test('F#166 publica, reconfirma y descarga las filas rechazadas del CSV', async ({ page }) => {
  const account = newAccount('Comercio de precios');
  await register(page.request, account);
  await signIn(page.request, account);

  const stores = await page.request.get('/v1/establishments?municipality=armenia&limit=50');
  expect(stores.ok()).toBe(true);
  const { items } = (await stores.json()) as { items: { id: string; lat: number; lng: number }[] };
  const shop = items.at(-1);
  if (!shop || items.length < 2)
    throw new Error('La semilla necesita al menos dos tiendas de Armenia');

  const session = await page.request.get('/v1/auth/session');
  expect(session.ok()).toBe(true);
  const { csrfToken } = (await session.json()) as { csrfToken: string };
  const claim = await page.request.post('/v1/commerce/claims', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      establishmentId: shop.id,
      responsibleName: 'Rosa Gómez',
      phone: '3001234567',
      acceptedTermsVersion: '2026-11',
      location: { lat: shop.lat, lng: shop.lng },
    },
  });
  expect(claim.status(), await claim.text()).toBe(201);
  await expect
    .poll(async () => {
      const response = await page.request.get('/v1/auth/session');
      return ((await response.json()) as { role: string }).role;
    })
    .toBe('comercio');

  const [product] = await someProducts(page.request, 1);
  if (!product) throw new Error('La semilla no tiene productos para la prueba');
  await page.goto('/comercios');
  await page
    .getByRole('searchbox', { name: 'Buscar producto o código de barras' })
    .fill(product.name);
  await page.getByRole('button', { name: 'Buscar en el catálogo' }).click();
  const editor = page.getByRole('region', { name: 'Publicar o editar un precio' });
  await editor.getByRole('button').filter({ hasText: product.name }).first().click();
  await editor.getByLabel('Precio oficial en pesos').fill('2300');
  await editor.getByRole('button', { name: 'Publicar precio' }).click();
  await expect(page.getByText('Precio oficial publicado.')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Mis precios' }).getByText('Vigente'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Todos mis precios siguen igual' }).click();
  await expect(page.getByText('Precios reconfirmados: 1.')).toBeVisible();

  await page.getByLabel('Archivo CSV').setInputFiles({
    name: 'precios.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('codigo_barras;precio\n01234567;invalido\n'),
  });
  await page.getByRole('button', { name: 'Cargar precios' }).click();
  await expect(page.getByText('Filas publicadas: 0.')).toBeVisible();
  await expect(page.getByText('Fila 2', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar filas con errores' }).click();
  expect((await download).suggestedFilename()).toBe('precios-por-corregir.csv');
});
