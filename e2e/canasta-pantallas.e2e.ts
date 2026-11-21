import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator } from '@playwright/test';
import { basketOf, fakeApi, PRODUCTS, seed } from './support/planFake';

// Lista de compras (/canasta) con nombres muy largos y cortos: sin desborde horizontal, el selector de
// cantidad no pisa el nombre ni la casilla ni la papelera, y los objetivos táctiles miden 24 px o más
// (WCAG 2.5.8; en celular lo ideal son 44 px). Sin backend: /v1 es falso. Con CANASTA_EVIDENCIA se
// guarda una captura fullPage (escala 1) de cada tamaño en esa carpeta, que debe quedar fuera del repo.
const EVIDENCIA = process.env['CANASTA_EVIDENCIA'];
const SIZES = [
  { name: 'celular-360', width: 360, height: 740 },
  { name: 'celular-390', width: 390, height: 844 },
  { name: 'tableta-820', width: 820, height: 1180 },
  { name: 'tableta-768', width: 768, height: 1024 },
  { name: 'pc-1280', width: 1280, height: 800 },
  { name: 'pc-1440', width: 1440, height: 900 },
];
const MIN_TARGET = 24;
const NAMES = [
  'Arroz blanco premium extra largo grano seleccionado bolsa familiar de cocina',
  'Leche',
  'Aceite de girasol refinado vitaminizado botella plástica retornable edición especial limitada',
];

const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  if (!b) throw new Error('Elemento sin caja visible');
  return b;
};
type Box = Awaited<ReturnType<typeof box>>;
// Los renglones de texto de un elemento: el texto puede salirse de la caja del enlace sin que ella lo
// note, así que lo que no debe pisarse es el texto, no solo la caja.
const textLines = (locator: Locator) =>
  locator.evaluate((el): Box[] => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()]
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
  });
const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const describeBox = (b: Box) =>
  `${String(Math.round(b.x))},${String(Math.round(b.y))} ${String(Math.round(b.width))}×${String(Math.round(b.height))}`;

for (const size of SIZES) {
  test(`/canasta con nombres largos a ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const products = PRODUCTS.slice(0, 3).map((p, i) => ({ ...p, name: NAMES[i] ?? p.name }));
    await seed(page, 'valora:canasta', basketOf(products));
    await fakeApi(page);
    await page.goto('/canasta');
    // (d) Textos clave visibles.
    await expect(page.getByRole('heading', { name: 'Mi canasta' })).toBeVisible();
    await expect(page.getByText('Te decimos dónde te sale más barata.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Armar plan de compra' })).toBeVisible();
    for (const name of NAMES) await expect(page.getByRole('link', { name })).toBeVisible();

    const problemas: string[] = [];
    for (const [i, name] of NAMES.entries()) {
      const row = page.getByRole('listitem').filter({ has: page.getByRole('link', { name }) });
      const parts = {
        nombre: await box(row.getByRole('link', { name })),
        renglones: await textLines(row.getByRole('link', { name })),
        casilla: await box(row.locator('.basket-check')),
        menos: await box(row.getByRole('button', { name: /^Quitar uno de/ })),
        mas: await box(row.getByRole('button', { name: /^Agregar uno de/ })),
        papelera: await box(row.getByRole('button', { name: /^Quitar .* de la canasta$/ })),
      };
      const selector = await box(row.locator('.stepper'));
      // (b) Nada se pisa con el nombre ni con la casilla o la papelera.
      const pares: [string, Box, string, Box][] = [
        ['selector', selector, 'nombre', parts.nombre],
        ['selector', selector, 'casilla', parts.casilla],
        ['selector', selector, 'papelera', parts.papelera],
        ['papelera', parts.papelera, 'nombre', parts.nombre],
        ['casilla', parts.casilla, 'nombre', parts.nombre],
      ];
      for (const [j, renglon] of parts.renglones.entries())
        if (intersects(selector, renglon))
          problemas.push(
            `fila ${String(i)}: selector (${describeBox(selector)}) pisa el renglón ${String(j)} del nombre (${describeBox(renglon)})`,
          );
      for (const [a, ba, b, bb] of pares)
        if (intersects(ba, bb))
          problemas.push(
            `fila ${String(i)}: ${a} (${describeBox(ba)}) pisa ${b} (${describeBox(bb)})`,
          );
      // (c) Objetivos táctiles de al menos 24×24 px: la casilla de verdad, −, + y papelera.
      const objetivos: [string, Box][] = [
        ['casilla', await box(row.getByRole('checkbox'))],
        ['menos', parts.menos],
        ['mas', parts.mas],
        ['papelera', parts.papelera],
      ];
      for (const [n, b] of objetivos)
        if (b.width < MIN_TARGET || b.height < MIN_TARGET)
          problemas.push(`fila ${String(i)}: ${n} mide ${describeBox(b)}`);
      // En celular, además, la zona táctil de la casilla (su etiqueta) es de 44 px.
      if (size.width < 600 && (parts.casilla.width < 44 || parts.casilla.height < 44))
        problemas.push(`fila ${String(i)}: zona de la casilla ${describeBox(parts.casilla)} < 44`);
    }
    // (a) Sin desbordamiento horizontal.
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    if (scroll > client)
      problemas.push(`página: scrollWidth ${String(scroll)} > ${String(client)}`);
    if (EVIDENCIA) {
      mkdirSync(EVIDENCIA, { recursive: true });
      await page.screenshot({ path: join(EVIDENCIA, `canasta-${size.name}.png`), fullPage: true });
    }
    expect(problemas, `problemas en /canasta a ${size.name}`).toEqual([]);
  });
}
