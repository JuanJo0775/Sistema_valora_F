import { expect, type Locator, type Page } from '@playwright/test';
import type { Store } from './api';

// Pasos de pantalla que repiten las pruebas, escritos como los haría una persona.

// Las opciones de la app son fichas: el radio va escondido dentro de su etiqueta y la persona toca
// la ficha. Se toca la etiqueta y se comprueba que el radio quedó elegido.
export async function choose(radio: Locator) {
  await radio.locator('xpath=ancestor::label[1]').click();
  await expect(radio).toBeChecked();
}

export async function chooseFirstPresentation(page: Page) {
  await choose(page.getByRole('radiogroup', { name: 'Presentación' }).getByRole('radio').first());
}

export async function chooseStoreByName(page: Page, store: Store) {
  await page.getByRole('searchbox', { name: 'Buscar tienda por nombre' }).fill(store.name);
  await page.getByRole('button', { name: 'Buscar tienda' }).click();
  // La semilla del Quindío puede devolver otras tiendas con el mismo nombre.
  const byId = page.locator(`input[type="radio"][value="${store.id}"]`);
  await choose(page.getByRole('radio', { name: store.name, exact: true }).and(byId));
}

export async function sendPrice(page: Page, priceCop: number) {
  await page.getByLabel('Precio en pesos').fill(String(priceCop));
  await page.getByRole('button', { name: 'Enviar' }).click();
}

// «$4.321», como lo escribe la app.
export const pesos = (value: number) => `$${new Intl.NumberFormat('es-CO').format(value)}`;

export async function expectHeading(page: Page, name: string) {
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

// La comparación se arma con el repartidor de eventos (ADR-015): un precio nuevo, o uno recién
// descartado, tarda un momento en verse. Se recarga hasta que la condición se cumple.
// Además, la comparación por municipio se puede guardar en la caché hasta 30 s (ADR-031): sin más,
// las recargas verían lo mismo que la primera visita. Aquí siempre se pide revalidarla.
const revalidating = new WeakSet<Page>();
export async function eventually(page: Page, check: () => Promise<void>) {
  if (!revalidating.has(page)) {
    revalidating.add(page);
    await page.route('**/v1/products/*/comparison*', (route) =>
      route.continue({ headers: { ...route.request().headers(), 'cache-control': 'no-cache' } }),
    );
  }
  await expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout: 30_000 });
}

// Elige una opción de una lista propia (SelectField): abre el campo por su etiqueta y toca la opción
// (en celular se abre como hoja inferior; el rol de las opciones es el mismo).
export async function chooseOption(page: Page, field: string, option: string) {
  await page.getByRole('button', { name: new RegExp(`^${field}`) }).click();
  await page.getByRole('option', { name: option }).click();
}
