import { expect, test } from '@playwright/test';
import { newAccount, register, signIn } from './support/api';

type Shop = { id: string; name: string; lat: number; lng: number };

async function fillResponsible(page: import('@playwright/test').Page) {
  await page.getByLabel('Nombre del responsable').fill('Rosa Gómez');
  await page.getByLabel('Teléfono').fill('3001234567');
  await page.getByRole('checkbox', { name: 'Acepto las condiciones para comercios' }).check();
}

test.describe('Registro de comercios (F#165)', () => {
  test.use({ permissions: ['geolocation'], geolocation: { latitude: 4.535, longitude: -75.6811 } });

  test('desde la ficha registra una tienda del mapa y cambia el rol', async ({ page, context }) => {
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
