import { expect, type Page } from '@playwright/test';
import type { Store } from './api';

// Pasos de pantalla que repiten las pruebas, escritos como los haría una persona.

export async function chooseFirstPresentation(page: Page) {
  await page.getByRole('radiogroup', { name: 'Presentación' }).getByRole('radio').first().check();
}

export async function chooseStoreByName(page: Page, store: Store) {
  await page.getByRole('searchbox', { name: 'Buscar tienda por nombre' }).fill(store.name);
  await page.getByRole('button', { name: 'Buscar tienda' }).click();
  await page.getByRole('radio', { name: store.name, exact: true }).check();
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
