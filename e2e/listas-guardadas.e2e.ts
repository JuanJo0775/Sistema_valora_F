import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { basketOf, fakeApi, PRODUCTS, savedPlan, seed } from './support/planFake';

// Listas guardadas dentro de la canasta (/canasta): pestañas «Mi lista | Guardadas», «Guardar lista»
// (en su pantalla /canasta/donde-comprar) y las tarjetas con sus acciones. Sin backend: /v1 es falso. Con LISTAS_EVIDENCIA
// se guardan capturas (escala 1) en esa carpeta, que debe quedar fuera del repo.
const EVIDENCIA = process.env['LISTAS_EVIDENCIA'];
const SIZES = [
  { name: 'celular-360', width: 360, height: 740 },
  { name: 'celular-390', width: 390, height: 844 },
  { name: 'tableta-768', width: 768, height: 1024 },
  { name: 'tableta-820', width: 820, height: 1180 },
  { name: 'pc-1280', width: 1280, height: 800 },
  { name: 'pc-1440', width: 1440, height: 900 },
];
const MIN_TARGET = 24;

const shot = async (page: Page, name: string) => {
  if (!EVIDENCIA) return;
  // Las fichas tienen una transición corta: se espera a que termine para fotografiar el estado final.
  await page.waitForTimeout(400);
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${name}.png`), fullPage: true });
};

// Tres listas: una con precios y nombre, una sin precios y una anterior (sin nombre).
const lists = () => {
  const named = { ...savedPlan('lista-semanal', 2), listName: 'Mercado semanal' };
  const unpriced = {
    ...savedPlan('lista-sin-precios', 2),
    listName: 'Solo la lista',
    savedAt: '2026-11-19T12:00:00Z',
    stores: [],
    lines: savedPlan('x', 2).lines.map((l) => ({ ...l, storeId: null, priceCop: null })),
  };
  const old = { ...savedPlan('lista-antigua', 2), savedAt: '2026-11-17T15:00:00Z' };
  return [named, unpriced, old];
};

const basketNames = (page: Page) =>
  page.evaluate(() =>
    (JSON.parse(localStorage.getItem('valora:canasta') ?? '[]') as { productName: string }[]).map(
      (i) => i.productName,
    ),
  );

const noOverflow = async (page: Page) => {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'desborde horizontal').toBeLessThanOrEqual(client);
};

// Lo que se puede tocar en el panel y mide menos de 24 px.
const smallTargets = (panel: Locator) =>
  panel.evaluate((root, min) => {
    const small: string[] = [];
    for (const el of root.querySelectorAll('a[href], button, input')) {
      // Las casillas de radio van escondidas dentro de su tarjeta: se mide la tarjeta.
      if (el.matches('input[type=radio]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < min || r.height < min)
        small.push(`${el.textContent || el.tagName} ${String(r.width)}×${String(r.height)}`);
    }
    return small;
  }, MIN_TARGET);

// Dentro de cada tarjeta el orden del DOM es el visual (arriba→abajo, izquierda→derecha), y las
// tarjetas siguen el orden de lectura.
const focusOrderIsVisual = (panel: Locator) =>
  panel.evaluate(() => {
    const problems: string[] = [];
    const cards = [...document.querySelectorAll('.saved-list')];
    let prev: DOMRect | undefined;
    for (const card of cards) {
      const top = card.getBoundingClientRect();
      if (prev && (top.y < prev.y - 1 || (Math.abs(top.y - prev.y) <= 1 && top.x < prev.x)))
        problems.push('tarjetas fuera de orden');
      prev = top;
      let last: DOMRect | undefined;
      for (const el of card.querySelectorAll('a[href], button')) {
        const r = el.getBoundingClientRect();
        if (last && (r.y < last.y - 1 || (Math.abs(r.y - last.y) <= 1 && r.x < last.x)))
          problems.push(`${el.textContent} fuera de orden`);
        last = r;
      }
    }
    return problems;
  });

for (const size of SIZES) {
  test(`/canasta?tab=guardadas a ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
    await seed(page, 'valora:planes', { v: 1, plans: lists() });
    await fakeApi(page);
    await page.goto('/canasta?tab=guardadas');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi canasta' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Guardadas (3)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByRole('heading', { name: 'Mercado semanal' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: /^Plan del 17 nov$/ })).toBeVisible();
    await expect(panel.getByText('Sin precios guardados')).toBeVisible();
    await noOverflow(page);
    expect(await smallTargets(panel)).toEqual([]);
    expect(await focusOrderIsVisual(panel)).toEqual([]);
    await shot(page, `guardadas-${size.name}`);
  });

  test(`/canasta/donde-comprar con «Guardar lista» a ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
    await fakeApi(page);
    await page.goto('/canasta/donde-comprar');
    const where = page.getByRole('complementary', { name: 'Guardar lista' });
    await expect(where.getByRole('button', { name: 'Guardar lista' })).toBeVisible();
    await noOverflow(page);
    expect(await smallTargets(where)).toEqual([]);
    await shot(page, `mi-lista-${size.name}`);
    await where.getByRole('textbox', { name: 'Nombre de la lista' }).fill('Mercado semanal');
    await where.getByRole('button', { name: 'Guardar lista' }).click();
    await expect(where.getByText('Lista guardada')).toBeVisible();
    await shot(page, `guardar-lista-${size.name}`);
  });
}

test('guardar «Mercado semanal», vaciar la canasta y volver a usarla', async ({ page }) => {
  await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
  await fakeApi(page);
  await page.goto('/canasta');
  // Guardar vive en su pantalla: «Ver dónde comprar» en el resumen lleva a ella.
  await page.getByRole('link', { name: 'Ver dónde comprar' }).click();
  const where = page.getByRole('complementary', { name: 'Guardar lista' });
  await where.getByRole('textbox', { name: 'Nombre de la lista' }).fill('Mercado semanal');
  await where.getByRole('button', { name: 'Guardar lista' }).click();
  await where.getByRole('link', { name: 'Ver en Guardadas' }).click();
  await expect(page.getByRole('heading', { name: 'Mercado semanal' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Guardadas (1)' })).toBeVisible();

  // Vaciar la canasta desde «Mi lista».
  await page.getByRole('tab', { name: 'Mi lista' }).click();
  for (let i = 0; i < 3; i++)
    await page
      .getByRole('button', { name: /^Quitar .* de la canasta$/ })
      .first()
      .click();
  await expect(page.getByRole('heading', { name: 'Tu canasta está vacía' })).toBeVisible();
  await shot(page, 'mi-lista-vacia');

  // «Guardadas» sigue a mano con la canasta vacía, y usar la lista no pregunta.
  await page.getByRole('tab', { name: 'Guardadas (1)' }).click();
  await shot(page, 'guardadas-con-canasta-vacia');
  await page.getByRole('button', { name: /^Usar esta lista/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Listo: cargamos «Mercado semanal» en tu canasta')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Mi lista' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(await basketNames(page)).toHaveLength(3);
});

test('«Reemplazar mi lista» cambia la canasta y «Agregar a mi lista» la suma', async ({ page }) => {
  await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 1)));
  await seed(page, 'valora:planes', { v: 1, plans: lists() });
  await fakeApi(page);
  await page.goto('/canasta?tab=guardadas');
  const use = page.getByRole('button', { name: 'Usar esta lista: Mercado semanal' });

  await use.click();
  const dialog = page.getByRole('dialog', { name: 'Usar «Mercado semanal»' });
  await expect(dialog.getByRole('button', { name: 'Reemplazar mi lista' })).toBeFocused();
  await shot(page, 'dialogo-usar-lista');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(use).toBeFocused();

  await use.click();
  await dialog.getByRole('button', { name: 'Agregar a mi lista' }).click();
  await expect(page.getByText(/Listo: agregamos «Mercado semanal»/)).toBeVisible();
  // Lo que había (arroz) más las 3 líneas de la lista.
  expect(await basketNames(page)).toHaveLength(4);

  await page.getByRole('tab', { name: /Guardadas/ }).click();
  await page.getByRole('button', { name: 'Usar esta lista: Mercado semanal' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reemplazar mi lista' }).click();
  await expect(page.getByText('Listo: cargamos «Mercado semanal» en tu canasta')).toBeVisible();
  expect(await basketNames(page)).toHaveLength(3);
});

test('renombrar, duplicar y borrar una lista con el teclado', async ({ page }) => {
  await seed(page, 'valora:planes', { v: 1, plans: lists() });
  await fakeApi(page);
  await page.goto('/canasta?tab=guardadas');
  await page.getByRole('button', { name: 'Renombrar Mercado semanal' }).click();
  const field = page.getByRole('textbox', { name: 'Nombre de la lista' });
  await expect(field).toBeFocused();
  await field.fill('Mercado del mes');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Mercado del mes' })).toBeVisible();
  await page.getByRole('button', { name: 'Duplicar Mercado del mes' }).click();
  await expect(page.getByRole('heading', { name: 'Mercado del mes (copia)' })).toBeVisible();
  await page.getByRole('button', { name: 'Borrar Mercado del mes (copia)' }).click();
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.getByRole('heading', { name: 'Mercado del mes (copia)' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Guardadas (3)' })).toBeVisible();
});

test('modo oscuro a 1440 px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
  await seed(page, 'valora:planes', { v: 1, plans: lists() });
  await fakeApi(page);
  await page.goto('/canasta?tab=guardadas');
  await expect(page.getByRole('heading', { name: 'Mercado semanal' })).toBeVisible();
  await shot(page, 'guardadas-oscuro-pc-1440');
});
