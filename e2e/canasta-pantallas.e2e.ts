import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { basketOf, fakeApi, PRODUCTS, seed } from './support/planFake';
import { choose } from './support/screens';

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
    await expect(
      page.getByRole('link', { name: 'Ver el plan completo y guardarlo' }),
    ).toBeVisible();
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

// «Dónde comprar»: el panel de la canasta con las fichas 1, 2 y 3 tiendas. A la derecha de la lista en
// computador (desde 960 px) y debajo de ella en tableta y celular, con el foco en el orden en que se ve.
// Con CANASTA_EVIDENCIA se guarda una captura (escala 1) del panel por ficha.
const WIDE = 960;
const PLAN_LINK = 'Ver el plan completo y guardarlo';

// Lo que se puede tocar dentro del panel y mide menos de 24 px (WCAG 2.5.8). Las casillas de radio
// van escondidas dentro de su ficha: se mide la ficha (la etiqueta).
const smallTargets = (panel: Locator) =>
  panel.evaluate((root, min) => {
    const small: string[] = [];
    for (const el of root.querySelectorAll(
      'a[href], button, summary, input, label.category-chip',
    )) {
      if (el.matches('input[type=radio]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < min || r.height < min)
        small.push(
          `${el.tagName.toLowerCase()} «${el.textContent.trim().slice(0, 30)}» ${String(Math.round(r.width))}×${String(Math.round(r.height))}`,
        );
    }
    return small;
  }, MIN_TARGET);

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

// Captura de pantalla completa (escala 1) con la página y el panel arriba del todo.
const shot = async (page: Page, file: string) => {
  mkdirSync(EVIDENCIA ?? '.', { recursive: true });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('aside')?.scrollTo(0, 0);
  });
  await page.screenshot({ path: join(EVIDENCIA ?? '.', file), fullPage: true });
};

// Dónde está cada elemento que recibe el foco con Tab, desde el primer producto hasta el enlace del plan.
const tabStops = async (page: Page) => {
  await page.locator('.basket-row').first().getByRole('checkbox').focus();
  const stops: { inPanel: boolean; cy: number; name: string }[] = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el?.closest('main')) return null;
      // La casilla de radio va escondida: lo que se ve es su ficha.
      const t = (
        el.matches('input[type=radio]') ? (el.closest('label') ?? el) : el
      ).getBoundingClientRect();
      return {
        inPanel: Boolean(el.closest('aside')),
        cy: t.y + window.scrollY + t.height / 2,
        name: (el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 60),
      };
    });
    if (!stop) break;
    stops.push(stop);
    if (stop.name === PLAN_LINK) break;
  }
  return stops;
};

for (const size of SIZES) {
  test.describe(`«Dónde comprar» a ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test.beforeEach(async ({ page }) => {
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await fakeApi(page);
      await page.goto('/canasta');
    });

    test('el panel con sus fichas queda a la derecha (computador) o debajo (tableta y celular)', async ({
      page,
    }) => {
      const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
      await expect(panel.getByRole('radiogroup', { name: 'Cuántas tiendas' })).toBeVisible();
      for (const name of ['1 tienda', '2 tiendas', '3 tiendas'])
        await expect(panel.locator('label.category-chip', { hasText: name })).toBeVisible();
      await expect(panel.getByRole('radio', { name: '1 tienda' })).toBeChecked();
      await expect(panel.getByText('Compra todo en')).toBeVisible();
      await expect(page.locator('main').getByRole('complementary')).toHaveCount(1);
      const [p, l] = [await box(panel), await box(page.locator('.basket'))];
      if (size.width >= WIDE)
        expect(p.x, 'panel a la derecha de la lista').toBeGreaterThan(l.x + l.width);
      else expect(p.y, 'panel debajo de la lista').toBeGreaterThanOrEqual(l.y + l.height - 1);
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(panel), 'objetivos menores de 24 px').toEqual([]);
      if (size.width < 600) {
        const chip = await box(panel.locator('label.category-chip').first());
        expect(chip.height, 'ficha de 44 px en celular').toBeGreaterThanOrEqual(44);
      }
      if (EVIDENCIA) {
        await shot(page, `panel-${size.name}-1-tienda.png`);
      }
    });

    test('«2 tiendas» muestra tiendas con «Cómo llegar» y el traslado plegado', async ({
      page,
    }) => {
      const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
      await choose(panel.getByRole('radio', { name: '2 tiendas' }));
      const ways = panel.getByRole('link', { name: /^Cómo llegar a/ });
      await expect(ways.first()).toBeVisible();
      expect(await ways.count()).toBeGreaterThanOrEqual(2);
      const fold = panel.getByText('Traslado y domicilio (estimado)');
      await expect(fold).toBeVisible();
      await expect(panel.getByText('Supuestos del traslado')).toBeHidden();
      await fold.click();
      await expect(panel.getByText('Supuestos del traslado')).toBeVisible();
      await expect(panel.getByRole('link', { name: PLAN_LINK })).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(panel), 'objetivos menores de 24 px').toEqual([]);
      if (EVIDENCIA) {
        await shot(page, `panel-${size.name}-2-tiendas.png`);
        if (size.width === 1440) {
          await page.emulateMedia({ colorScheme: 'dark' });
          await shot(page, `panel-${size.name}-2-tiendas-oscuro.png`);
          await choose(panel.getByRole('radio', { name: '1 tienda' }));
          await shot(page, `panel-${size.name}-1-tienda-oscuro.png`);
        }
      }
    });

    test('las flechas cambian de ficha sin saltarse ninguna', async ({ page }) => {
      const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
      await panel.getByRole('radio', { name: '1 tienda' }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(panel.getByRole('radio', { name: '2 tiendas' })).toBeChecked();
      await expect(panel.getByRole('radio', { name: '2 tiendas' })).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(panel.getByRole('radio', { name: '1 tienda' })).toBeChecked();
    });

    test('el orden de foco es el orden visual: la lista y luego el panel', async ({ page }) => {
      test.skip(size.width >= WIDE, 'En computador son dos columnas, de izquierda a derecha');
      await expect(page.getByText('Compra todo en')).toBeVisible();
      const stops = await tabStops(page);
      const inPanel = stops.filter((s) => s.inPanel);
      expect(inPanel.length, 'el panel recibe el foco').toBeGreaterThanOrEqual(3);
      expect(stops.at(-1)?.name).toBe(PLAN_LINK);
      // Toda la lista antes que el panel, y dentro del panel, de arriba abajo.
      const firstPanel = stops.findIndex((s) => s.inPanel);
      expect(
        stops.slice(firstPanel).every((s) => s.inPanel),
        'la lista no vuelve después',
      ).toBe(true);
      const sorted = [...inPanel].sort((a, b) => a.cy - b.cy);
      expect(
        inPanel.map((s) => s.name),
        'el foco del panel va como se ve',
      ).toEqual(sorted.map((s) => s.name));
      expect(stops[firstPanel - 1]?.cy ?? 0, 'la lista queda arriba').toBeLessThan(
        inPanel[0]?.cy ?? 0,
      );
    });
  });
}
