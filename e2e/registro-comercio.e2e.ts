import { expect, type Page, test } from '@playwright/test';
import { newAccount, register, signIn, someProducts } from './support/api';

type Shop = { id: string; name: string; lat: number; lng: number };

async function fillResponsible(page: import('@playwright/test').Page) {
  await page.getByLabel('Nombre del responsable').fill('Rosa Gómez');
  await page.getByLabel('Teléfono').fill('3001234567');
  await page.getByRole('checkbox', { name: 'Acepto las condiciones para comercios' }).check();
}

test.describe('Registro de comercios (F#165)', () => {
  test.use({ permissions: ['geolocation'], geolocation: { latitude: 4.535, longitude: -75.6811 } });

  test('registra una tienda del mapa, publica precios, reconfirma y descarga errores CSV', async ({
    page,
    context,
  }) => {
    const account = newAccount('Comercio de prueba');
    await register(page.request, account);
    await signIn(page.request, account);
    const response = await page.request.get('/v1/establishments?municipality=armenia&limit=50');
    expect(response.ok()).toBe(true);
    const { items } = (await response.json()) as { items: Shop[] };
    const shop = items[0];
    if (!shop) throw new Error('La base de pruebas no tiene tiendas de Armenia.');
    await context.setGeolocation({ latitude: shop.lat, longitude: shop.lng });

    await page.goto(`/tiendas/${shop.id}`);
    await page.getByRole('link', { name: '¿Eres el dueño? Registra tu tienda' }).click();
    await expect(page.getByRole('radio', { name: shop.name })).toBeChecked();
    await fillResponsible(page);
    await page.getByRole('button', { name: 'Compartir mi ubicación y registrar' }).click();

    await expect(page.getByRole('heading', { name: 'Tu tienda quedó verificada' })).toBeVisible();
    await page.getByRole('link', { name: 'Volver a Yo' }).click();
    await expect(page.getByText('Comercio', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: /Mi tienda/ }).click();
    await verifyOfficialPrices(page);
  });

  test('desde Yo propone una tienda nueva y recupera la preaprobación al recargar', async ({
    page,
  }) => {
    const account = newAccount('Comercio sin mapa');
    await register(page.request, account);
    await signIn(page.request, account);

    await page.goto('/yo');
    await page.getByRole('link', { name: /Registrar mi tienda/ }).click();
    await page.getByRole('button', { name: 'Mi tienda no está en el mapa' }).click();
    await page.getByLabel('Nombre de la tienda').fill(`Tienda de prueba ${String(Date.now())}`);
    await fillResponsible(page);
    await page.getByRole('button', { name: 'Compartir mi ubicación y registrar' }).click();

    const pending = page.getByRole('heading', { name: 'Tu tienda quedó preaprobada' });
    await expect(pending).toBeVisible();
    await expect(page.getByText('Publicar precios oficiales')).toBeVisible();
    await page.reload();
    await expect(pending).toBeVisible();
  });
});

async function verifyOfficialPrices(page: Page) {
  const [product] = await someProducts(page.request, 1);
  if (!product) throw new Error('La semilla no tiene productos para la prueba');

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

  await page.getByRole('button', { name: 'Carga masiva' }).click();
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
}
