import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { basketOf, fakeApi, PRODUCTS, savedPlan, seed } from './support/planFake';

// Presencia de la canasta y de las listas guardadas fuera de /canasta: el panel «Tu canasta» del Inicio
// y el atajo en «Yo». Con y sin listas, sin backend (/v1 es falso). Con LISTAS_EVIDENCIA se guardan
// capturas (escala 1) en esa carpeta, que debe quedar fuera del repo.
const EVIDENCIA = process.env['LISTAS_EVIDENCIA'];
const SIZES = [
  { name: 'celular-360', width: 360, height: 740 },
  { name: 'tableta-768', width: 768, height: 1024 },
  { name: 'pc-1440', width: 1440, height: 900 },
];
const MIN_TARGET = 24;
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core'), 'utf8');

const lists = () => [
  { ...savedPlan('lista-semanal', 2), listName: 'Mercado semanal' },
  { ...savedPlan('lista-antigua', 2), savedAt: '2026-11-17T15:00:00Z' },
];

const shot = async (page: Page, name: string) => {
  if (!EVIDENCIA) return;
  await page.waitForTimeout(400);
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${name}.png`), fullPage: true });
};

// Lo que toda pantalla cumple: sin desborde horizontal, un solo h1, objetivos de 24 px o más, un solo
// «complementary» dentro del contenido y sin fallas graves ni críticas de axe.
const expectHealthy = async (page: Page, asides: number) => {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'desborde horizontal').toBeLessThanOrEqual(client);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('complementary')).toHaveCount(asides);
  const small = await page.getByRole('main').evaluate((root, min) => {
    const found: string[] = [];
    for (const el of root.querySelectorAll('a[href], button, input')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < min || r.height < min)
        found.push(`${el.textContent || el.tagName} ${String(r.width)}×${String(r.height)}`);
    }
    return found;
  }, MIN_TARGET);
  expect(small).toEqual([]);
  await page.evaluate(axeSource);
  const bad = await page.evaluate(async () => {
    const { violations } = await (
      window as unknown as {
        axe: { run: (n: Element) => Promise<{ violations: { id: string; impact: string }[] }> };
      }
    ).axe.run(document.body);
    return violations
      .filter(({ impact }) => impact === 'serious' || impact === 'critical')
      .map(({ id }) => id);
  });
  expect(bad).toEqual([]);
};

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test(`Inicio con canasta y sin listas, a ${size.name}`, async ({ page }) => {
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await fakeApi(page);
      await page.goto('/');
      const card = page.getByRole('region', { name: /^Tu canasta · 3 productos/ });
      await expect(card.getByRole('link', { name: 'Ver mi canasta' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Mis listas guardadas/ })).toHaveCount(0);
      await expectHealthy(page, 1);
      await shot(page, `inicio-sin-listas-${size.name}`);
    });

    test(`Inicio con canasta y listas, a ${size.name}`, async ({ page }) => {
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await seed(page, 'valora:planes', { v: 1, plans: lists() });
      await fakeApi(page);
      await page.goto('/');
      const card = page.getByRole('region', { name: /^Tu canasta · 3 productos/ });
      await expect(card.getByRole('link', { name: 'Ver mi canasta' })).toBeVisible();
      await expectHealthy(page, 1);
      // El foco sigue el orden visual: «Ver mi canasta» antes que el enlace a las listas.
      await card.getByRole('link', { name: 'Ver mi canasta' }).focus();
      await page.keyboard.press('Tab');
      await expect(card.getByRole('link', { name: 'Mis listas guardadas (2)' })).toBeFocused();
      await shot(page, `inicio-con-listas-${size.name}`);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('tab', { name: 'Guardadas (2)' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    test(`Inicio con la canasta vacía y listas, a ${size.name}`, async ({ page }) => {
      await seed(page, 'valora:planes', { v: 1, plans: lists() });
      await fakeApi(page);
      await page.goto('/');
      const card = page.getByRole('region', { name: 'Tu canasta' });
      await expect(card.getByRole('link', { name: 'Abre una lista guardada' })).toBeVisible();
      await expectHealthy(page, 1);
      await shot(page, `inicio-vacia-con-listas-${size.name}`);
    });

    test(`Inicio sin canasta ni listas, a ${size.name}`, async ({ page }) => {
      await fakeApi(page);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('region', { name: /^Tu canasta/ })).toHaveCount(0);
      await expectHealthy(page, 1);
    });

    test(`Yo sin listas, a ${size.name}`, async ({ page }) => {
      await fakeApi(page);
      await page.goto('/yo');
      await expect(page.getByRole('heading', { level: 1, name: 'Tu cuenta' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Mis listas guardadas/ })).toHaveCount(0);
      await expectHealthy(page, 0);
      await shot(page, `yo-sin-listas-${size.name}`);
    });

    test(`Yo con listas, a ${size.name}`, async ({ page }) => {
      await seed(page, 'valora:planes', { v: 1, plans: lists() });
      await fakeApi(page);
      await page.goto('/yo');
      const row = page.getByRole('link', { name: /Mis listas guardadas \(2\)/ });
      await expect(row).toBeVisible();
      await expectHealthy(page, 0);
      await shot(page, `yo-con-listas-${size.name}`);
      await row.click();
      await expect(page.getByRole('tab', { name: 'Guardadas (2)' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });
}
