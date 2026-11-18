import { expect, test } from '@playwright/test';
import { newAccount, plausiblePrice, someProducts, someStores } from './support/api';
import {
  chooseFirstPresentation,
  chooseStoreByName,
  eventually,
  expectHeading,
  pesos,
  sendPrice,
} from './support/screens';

// H2-01, paso 9 (B#17): el camino principal de punta a punta, con el backend de verdad.
test('una persona crea su cuenta, registra un precio y lo ve en la comparación del producto', async ({
  page,
}) => {
  const account = newAccount('Ana Prueba');
  const [product] = await someProducts(page.request, 1);
  const [store] = await someStores(page.request, 1);
  if (!product || !store) throw new Error('Sin datos de la semilla');
  const presentationId = product.presentations[0]?.id;
  if (!presentationId) throw new Error('Sin presentaciones en la semilla');
  // Un precio verosímil frente a lo que ya hay (ADR-030): uno fijo podría quedar «En revisión».
  const price = await plausiblePrice(page.request, product.id, presentationId);

  await page.goto('/crear-cuenta?volver=/yo');
  await page.getByLabel('Tu nombre').fill(account.displayName);
  await page.getByLabel('Correo').fill(account.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
  await page.getByRole('checkbox', { name: /política de tratamiento de datos/ }).check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expectHeading(page, 'Hola, Ana Prueba');

  await page.goto(`/registrar?producto=${product.id}`);
  await expectHeading(page, product.name);
  await chooseFirstPresentation(page);
  await chooseStoreByName(page, store);
  await sendPrice(page, price);
  await expectHeading(page, 'Recibido');

  await page.goto(`/productos/${product.id}`);
  const stores = page.getByRole('region', { name: 'Todas las tiendas' });
  const row = stores.getByRole('listitem').filter({ hasText: store.name });
  await eventually(page, async () => {
    await expect(row.first()).toContainText(pesos(price), { timeout: 2_000 });
  });
});
