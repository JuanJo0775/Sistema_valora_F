import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { basketOf, fakeApi, PRODUCTS, savedPlan, seed } from './support/planFake';
import { nestedScrollers, noOverflow, SIZES, smallTargets as small } from './support/layout';
import { choose } from './support/screens';

// Lista de compras (/canasta) con nombres muy largos y cortos: sin desborde horizontal, el selector de
// cantidad no pisa el nombre ni la casilla ni la papelera, y los objetivos táctiles miden 24 px o más
// (WCAG 2.5.8; en celular lo ideal son 44 px). Sin backend: /v1 es falso. Con CANASTA_EVIDENCIA se
// guarda una captura fullPage (escala 1) de cada tamaño en esa carpeta, que debe quedar fuera del repo.
const EVIDENCIA = process.env['CANASTA_EVIDENCIA'];
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
    await expect(page.getByText('Te decimos dónde te sale más barata.')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ver dónde comprar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar lista' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /plan completo/ })).toHaveCount(0);
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
    for (const nested of await nestedScrollers(page)) problemas.push(`scroll anidado: ${nested}`);
    if (EVIDENCIA) {
      mkdirSync(EVIDENCIA, { recursive: true });
      await page.screenshot({ path: join(EVIDENCIA, `canasta-${size.name}.png`), fullPage: true });
    }
    expect(problemas, `problemas en /canasta a ${size.name}`).toEqual([]);
  });
}

// «Dónde comprar» en dos pantallas. /canasta lleva un resumen corto (la mejor recomendación y el botón
// «Ver dónde comprar»): a la derecha de la lista en computador (desde 960 px) y debajo de ella en
// tableta y celular. /canasta/donde-comprar es la pantalla propia: las recomendaciones como un grupo de
// opciones, el detalle de la elegida y «Guardar lista» (a la derecha en computador, en una barra fija
// abajo en celular). El foco va en el orden en que se ve. Con CANASTA_EVIDENCIA se guarda una captura
// (escala 1) por estado.
const WIDE = 960;

const summaryOf = (page: Page) => page.getByRole('complementary', { name: 'Dónde comprar' });
const saveOf = (page: Page) => page.getByRole('complementary', { name: 'Guardar lista' });
const WHERE = '/canasta/donde-comprar';

// Lo que se puede tocar dentro de los paneles y mide menos de 24 px.
const smallTargets = (page: Page) => small(page, 'main');

// Captura de pantalla completa (escala 1) con la página arriba del todo.
const shot = async (page: Page, file: string) => {
  mkdirSync(EVIDENCIA ?? '.', { recursive: true });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: join(EVIDENCIA ?? '.', file), fullPage: true });
};

// Dónde está cada elemento que recibe el foco con Tab dentro del contenido, empezando en `start`.
const tabStops = async (page: Page, start: Locator) => {
  await start.focus();
  const stops: { inAside: boolean; cy: number; name: string }[] = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el?.closest('main')) return null;
      // La casilla de radio va escondida: lo que se ve es su ficha.
      const t = (
        el.matches('input[type=radio]') ? (el.closest('label') ?? el) : el
      ).getBoundingClientRect();
      return {
        inAside: Boolean(el.closest('aside')),
        cy: t.y + window.scrollY + t.height / 2,
        name: (el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 60),
      };
    });
    if (!stop) break;
    stops.push(stop);
  }
  return stops;
};

for (const size of SIZES) {
  test.describe(`/canasta, resumen de «Dónde comprar» a ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test.beforeEach(async ({ page }) => {
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await fakeApi(page);
      await page.goto('/canasta');
    });

    test('un resumen corto: la mejor recomendación, su total y el botón; sin guardar ni detalle', async ({
      page,
    }) => {
      const panel = summaryOf(page);
      await expect(panel.getByRole('link', { name: 'Ver dónde comprar' })).toBeVisible();
      await expect(panel.getByText(/\$\d/).first()).toBeVisible();
      await expect(panel.getByText(/tiendas?$/).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Guardar/ })).toHaveCount(0);
      await expect(page.getByRole('radiogroup', { name: 'Recomendaciones' })).toHaveCount(0);
      await expect(page.getByText('Te decimos dónde te sale más barata.')).toHaveCount(0);
      await expect(page.locator('main').getByRole('complementary')).toHaveCount(1);
      const [p, l] = [await box(panel), await box(page.locator('.basket'))];
      if (size.width >= WIDE)
        expect(p.x, 'resumen a la derecha de la lista').toBeGreaterThan(l.x + l.width);
      else expect(p.y, 'resumen debajo de la lista').toBeGreaterThanOrEqual(l.y + l.height - 1);
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(page), 'objetivos menores de 24 px').toEqual([]);
      expect(await nestedScrollers(page), 'scroll anidado').toEqual([]);
      if (size.width < 600) {
        const link = await box(panel.getByRole('link', { name: 'Ver dónde comprar' }));
        expect(link.height, 'botón de 44 px en celular').toBeGreaterThanOrEqual(44);
      }
      if (EVIDENCIA) {
        await shot(page, `resumen-${size.name}.png`);
        if (size.width === 1440) {
          await page.emulateMedia({ colorScheme: 'dark' });
          await shot(page, `resumen-${size.name}-oscuro.png`);
        }
      }
    });

    test('«Ver dónde comprar» lleva a la pantalla propia', async ({ page }) => {
      await summaryOf(page).getByRole('link', { name: 'Ver dónde comprar' }).click();
      await expect(page).toHaveURL(/\/canasta\/donde-comprar$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Dónde comprar' })).toBeVisible();
    });

    test('el orden de foco es el orden visual: la lista y luego el resumen', async ({ page }) => {
      await expect(summaryOf(page)).toBeVisible();
      const stops = await tabStops(page, page.locator('.basket-row').first().getByRole('checkbox'));
      const inAside = stops.filter((s) => s.inAside);
      expect(inAside.length, 'el resumen recibe el foco').toBeGreaterThanOrEqual(1);
      expect(stops.at(-1)?.inAside, 'el recorrido termina en el resumen').toBe(true);
      const first = stops.findIndex((s) => s.inAside);
      expect(
        stops.slice(first).every((s) => s.inAside),
        'la lista no vuelve después',
      ).toBe(true);
      if (size.width < WIDE)
        expect(stops[first - 1]?.cy ?? 0, 'la lista queda arriba').toBeLessThan(
          inAside[0]?.cy ?? 0,
        );
    });
  });

  test.describe(`/canasta/donde-comprar a ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test.beforeEach(async ({ page }) => {
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await fakeApi(page);
      await page.goto(WHERE);
    });

    test('las opciones, el detalle y guardar: en dos columnas (computador) o con la barra fija abajo', async ({
      page,
    }) => {
      const group = page.getByRole('radiogroup', { name: 'Recomendaciones' });
      await expect(group).toBeVisible();
      for (const name of ['La más barata', 'Todo en una tienda'])
        await expect(group.locator('label.rec-option', { hasText: name }).first()).toBeVisible();
      await expect(group.getByRole('radio', { name: 'La más barata' })).toBeChecked();
      await expect(page.getByText('Comparte tu ubicación para ver la más cercana.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/canasta');
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('main').getByRole('complementary')).toHaveCount(1);
      // Las opciones nunca se deslizan de lado: si no caben, se envuelven.
      expect(
        await group.evaluate((el) => el.scrollWidth <= el.clientWidth),
        'opciones sin scroll horizontal',
      ).toBe(true);
      const aside = saveOf(page);
      const [a, m] = [await box(aside), await box(page.locator('.where-main'))];
      if (size.width >= WIDE) {
        expect(a.x, 'guardar a la derecha').toBeGreaterThan(m.x + m.width);
        await expect(aside.getByRole('button', { name: 'Guardar lista' })).toBeInViewport();
        expect(a.y + a.height, 'guardar cabe en la altura de la pantalla').toBeLessThanOrEqual(
          size.height,
        );
      } else {
        // Barra fija: sobre la barra de navegación y sin tapar el final del contenido.
        const nav = await box(page.getByRole('navigation', { name: /principal/i }));
        expect(a.y + a.height, 'sobre la barra de navegación').toBeLessThanOrEqual(nav.y + 1);
        await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
        });
        const last = await box(
          page.locator('.where-main > *:last-child, .where-buy > *:last-child').last(),
        );
        const bar = await box(aside);
        expect(last.y + last.height, 'la barra no tapa el final').toBeLessThanOrEqual(bar.y + 1);
        await expect(aside.getByRole('button', { name: 'Guardar lista' })).toBeInViewport();
      }
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(page), 'objetivos menores de 24 px').toEqual([]);
      expect(await nestedScrollers(page), 'scroll anidado').toEqual([]);
      if (size.width < 600) {
        const card = await box(group.locator('label.rec-option').first());
        expect(card.height, 'opción de 44 px en celular').toBeGreaterThanOrEqual(44);
      }
      if (EVIDENCIA) {
        await shot(page, `donde-comprar-${size.name}.png`);
        if (size.width === 1440) {
          await page.emulateMedia({ colorScheme: 'dark' });
          await shot(page, `donde-comprar-${size.name}-oscuro.png`);
        }
      }
    });

    test('«Todo en una tienda» conserva la tarjeta naranja; la más barata muestra tiendas con «Cómo llegar» y el traslado plegado', async ({
      page,
    }) => {
      const ways = page.getByRole('link', { name: /^Cómo llegar a/ });
      await expect(ways.first()).toBeVisible();
      expect(await ways.count()).toBeGreaterThanOrEqual(2);
      const fold = page.getByText('Traslado y domicilio (estimado)');
      await expect(fold).toBeVisible();
      const how = page.getByText(/^Cómo estimamos esto:/);
      await expect(how).toBeHidden();
      await fold.click();
      await expect(how).toBeVisible();
      await expect(page.getByText('Factor de rodeo')).toHaveCount(0);
      await page.getByText('¿Cuánto te cuesta ir?').click();
      await expect(page.getByRole('radio', { name: 'Voy a pie' })).toBeChecked();
      // Las tres formas de desplazarse se envuelven: ninguna queda cortada ni se desliza.
      expect(
        await page
          .getByRole('radiogroup', { name: 'Cómo te desplazas' })
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
        'chips sin scroll horizontal',
      ).toBe(true);
      await expect(page.getByRole('button', { name: 'Guardar lista' })).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(page), 'objetivos menores de 24 px').toEqual([]);
      expect(await nestedScrollers(page), 'scroll anidado').toEqual([]);
      await choose(page.getByRole('radio', { name: 'Todo en una tienda' }));
      await expect(page.getByText('Compra todo en')).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(page), 'objetivos menores de 24 px').toEqual([]);
      expect(await nestedScrollers(page), 'scroll anidado').toEqual([]);
      if (EVIDENCIA) await shot(page, `donde-comprar-${size.name}-todo-en-una-tienda.png`);
    });

    test('las flechas cambian de opción sin saltarse ninguna', async ({ page }) => {
      await page.getByRole('radio', { name: 'La más barata' }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('radio', { name: 'Todo en una tienda' })).toBeChecked();
      await expect(page.getByRole('radio', { name: 'Todo en una tienda' })).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(page.getByRole('radio', { name: 'La más barata' })).toBeChecked();
    });

    test('el orden de foco es el orden visual: el contenido y luego guardar', async ({ page }) => {
      await expect(page.getByRole('radio', { name: 'La más barata' })).toBeVisible();
      const stops = await tabStops(page, page.getByRole('link', { name: 'Volver' }));
      const inAside = stops.filter((s) => s.inAside);
      expect(inAside.length, 'guardar recibe el foco').toBeGreaterThanOrEqual(2);
      expect(stops.at(-1)?.inAside, 'el recorrido termina en guardar').toBe(true);
      const first = stops.findIndex((s) => s.inAside);
      expect(
        stops.slice(first).every((s) => s.inAside),
        'el contenido no vuelve después',
      ).toBe(true);
      // Dentro del contenido, de arriba abajo (las opciones envueltas van por filas).
      const main = stops.slice(0, first);
      for (let i = 1; i < main.length; i++)
        expect(
          (main[i]?.cy ?? 0) + 4,
          `«${main[i]?.name ?? ''}» no sube respecto de «${main[i - 1]?.name ?? ''}»`,
        ).toBeGreaterThanOrEqual(main[i - 1]?.cy ?? 0);
    });
  });
}

// Casos extremos de «Dónde comprar»: valores enormes, sin precios, con error, con ubicación y con las
// guardadas llenas. Sin desborde horizontal y con objetivos táctiles de 24 px o más.
for (const size of SIZES) {
  test.describe(`«Dónde comprar», casos extremos a ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('con domicilio y pasaje de valores enormes y un producto sin precio', async ({ page }) => {
      await seed(page, 'valora:canasta', basketOf(PRODUCTS));
      await fakeApi(page);
      await page.goto(WHERE);
      await expect(page.getByRole('radio', { name: 'La más barata' })).toBeChecked();
      await expect(
        page.getByText(/Sin precio vigente cerca: Producto que nadie vende/),
      ).toBeVisible();
      await page.getByRole('switch', { name: 'Me lo llevan a casa' }).first().check();
      await page.getByLabel('¿Cuánto cobra el domicilio?').first().fill('1234567');
      // «¿Cuánto te cuesta ir?» va plegada: se abre y se elige «Pago pasaje».
      await page.getByText('¿Cuánto te cuesta ir?').click();
      await choose(page.getByRole('radio', { name: 'Pago pasaje' }));
      await page.getByLabel('Pasaje por viaje (COP)').fill('1500');
      await expect(page.getByRole('button', { name: 'Guardar lista' })).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(page), 'objetivos menores de 24 px').toEqual([]);
      expect(await nestedScrollers(page), 'scroll anidado').toEqual([]);
      if (EVIDENCIA) await shot(page, `extremos-${size.name}.png`);
    });

    test('sin precios cerca o con error, lo dice y deja guardar la lista', async ({ page }) => {
      await seed(page, 'valora:canasta', basketOf(PRODUCTS));
      await fakeApi(page, 'empty');
      await page.goto(WHERE);
      await expect(
        page.getByText(/Ningún producto de tu canasta tiene precio vigente/),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Guardar solo la lista' })).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(page), 'objetivos menores de 24 px').toEqual([]);
      if (EVIDENCIA) await shot(page, `sin-precio-${size.name}.png`);
      await page.unrouteAll();
      await fakeApi(page, 'error');
      await page.reload();
      await expect(page.getByText('No pudimos calcular dónde te sale más barata.')).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      if (EVIDENCIA) await shot(page, `error-${size.name}.png`);
    });

    test('con ubicación, radio y una lista guardada', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 4.5339, longitude: -75.6811 });
      await seed(page, 'valora:donde', 'ubicacion');
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await seed(page, 'valora:planes', { v: 1, plans: [savedPlan('plan-uno', 2)] });
      await fakeApi(page);
      await page.goto(WHERE);
      await expect(page.getByRole('radio', { name: /más cercana/ })).toBeVisible();
      const save = saveOf(page);
      await save.getByRole('button', { name: 'Guardar lista' }).click();
      await expect(save.getByText('Lista guardada')).toBeVisible();
      // El radio vive dentro del «¿Dónde?»: se abre (popover, o hoja inferior en celular) para verlo.
      await page.getByRole('button', { name: /^Dónde buscar: Cerca de mí/ }).click();
      await expect(page.getByText('Radio').first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(page), 'objetivos menores de 24 px').toEqual([]);
      if (EVIDENCIA) await shot(page, `ubicacion-guardada-${size.name}.png`);
      await save.getByRole('link', { name: 'Ver en Guardadas' }).click();
      await expect(page).toHaveURL(/\/canasta\?tab=guardadas$/);
      await expect(page.getByRole('tab', { name: 'Guardadas (2)' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    test('con 20 listas guardadas avisa que está lleno y lleva a «Guardadas»', async ({ page }) => {
      const plans = Array.from({ length: 20 }, (_, i) => savedPlan(`plan-${String(i)}`, 2));
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await seed(page, 'valora:planes', { v: 1, plans });
      await fakeApi(page);
      await page.goto(WHERE);
      const save = saveOf(page);
      await save.getByRole('button', { name: 'Guardar lista' }).click();
      await expect(save.getByText(/Ya tienes 20 listas guardadas/)).toBeVisible();
      await save.getByRole('link', { name: 'Ir a Guardadas' }).click();
      await expect(page).toHaveURL(/\/canasta\?tab=guardadas$/);
      await expect(page.getByRole('tab', { name: 'Guardadas (20)' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
    });
  });
}

test('con la canasta vacía, «Dónde comprar» invita a volver a la canasta', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeApi(page);
  await page.goto(WHERE);
  await expect(page.getByRole('heading', { level: 1, name: 'Dónde comprar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No hay nada por comprar' })).toBeVisible();
  await page.getByRole('link', { name: 'Ir a mi canasta' }).click();
  await expect(page).toHaveURL(/\/canasta$/);
  await expect(page.getByRole('heading', { name: 'Tu canasta está vacía' })).toBeVisible();
});

test('cambiar de ancho conserva los supuestos de la pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
  await fakeApi(page);
  await page.goto(WHERE);
  await page.getByText('¿Cuánto te cuesta ir?').click();
  await choose(page.getByRole('radio', { name: 'Pago pasaje' }));
  await page.getByLabel('Pasaje por viaje (COP)').fill('1500');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Pasaje por viaje (COP)')).toHaveValue('1500');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
});

test('los supuestos sobreviven a ir y volver entre las dos pantallas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
  await fakeApi(page);
  await page.goto('/canasta');
  await page.getByRole('link', { name: 'Ver dónde comprar' }).click();
  await page.getByText('¿Cuánto te cuesta ir?').click();
  await choose(page.getByRole('radio', { name: 'Pago pasaje' }));
  await page.getByRole('link', { name: 'Volver' }).click();
  await expect(page).toHaveURL(/\/canasta$/);
  await page.getByRole('link', { name: 'Ver dónde comprar' }).click();
  await page.getByText('¿Cuánto te cuesta ir?').click();
  await expect(page.getByRole('radio', { name: 'Pago pasaje' })).toBeChecked();
});

for (const size of [SIZES[0], SIZES[5]]) {
  if (!size) continue;
  for (const path of ['/canasta', WHERE]) {
    test(`${path} en modo oscuro a ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: 'dark' });
      await seed(page, 'valora:canasta', basketOf(PRODUCTS));
      await fakeApi(page);
      await page.goto(path);
      if (path === WHERE)
        await expect(page.getByRole('radio', { name: 'La más barata' })).toBeChecked();
      else await expect(page.getByRole('link', { name: 'Ver dónde comprar' })).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(page), 'objetivos menores de 24 px').toEqual([]);
      if (EVIDENCIA) await shot(page, `oscuro${path.replaceAll('/', '-')}-${size.name}.png`);
    });
  }
}

// ADR-031: la consulta es siempre por municipio y con la misma URL para todos (caché compartida); la
// cercanía se calcula en el dispositivo. Con N productos hay exactamente N solicitudes a /comparison,
// todas con la misma query, sin lat ni lng, también con «Cerca de mí», y cambiar de opción, de radio o
// de pantalla no hace ninguna más.
test.describe('«Dónde comprar»: solicitudes', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  const QUERY = 'municipality=armenia&sort=unit_price&onlyCurrent=true';
  // La CI compila el frontend con NODE_ENV=development (el backend lo necesita en ese trabajo): React
  // corre con StrictMode y monta los efectos dos veces, así que cada producto se pide dos veces en el
  // mismo instante. En producción es una vez. Lo que vigila el ADR-035 es que no se pida NADA más al
  // activar la ubicación, cambiar de opción, de radio o de pantalla, y que nunca viajen lat ni lng.
  const MOUNTS = process.env['NODE_ENV'] === 'development' ? 2 : 1;

  test('N productos, N solicitudes con la misma URL y ninguna con lat/lng, aun con «Cerca de mí» y al cambiar de pantalla', async ({
    page,
    context,
  }) => {
    const products = PRODUCTS.slice(0, 3);
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 4.5339, longitude: -75.6811 });
    const seen: URL[] = [];
    await seed(page, 'valora:canasta', basketOf(products));
    await fakeApi(page, 'ok', seen);
    await page.goto('/canasta');
    await expect(summaryOf(page).getByRole('link', { name: 'Ver dónde comprar' })).toBeVisible();

    const comparisons = () => seen.filter(({ pathname }) => pathname.endsWith('/comparison'));
    const expectSame = (label: string) => {
      const found = comparisons();
      expect(found, `${label}: una solicitud por producto`).toHaveLength(products.length * MOUNTS);
      expect(
        [...new Set(found.map(({ search }) => search.slice(1)))],
        `${label}: la misma query para todos`,
      ).toEqual([QUERY]);
      expect(
        found.some(({ searchParams }) => searchParams.has('lat') || searchParams.has('lng')),
        `${label}: sin lat ni lng`,
      ).toBe(false);
    };
    expectSame('en la canasta');

    // De la canasta a «Dónde comprar»: ninguna solicitud nueva.
    await summaryOf(page).getByRole('link', { name: 'Ver dónde comprar' }).click();
    await expect(page.getByRole('radio', { name: 'La más barata' })).toBeChecked();
    expectSame('al pasar a «Dónde comprar»');

    // «Cerca de mí»: la ubicación se usa solo en el dispositivo.
    await page.getByRole('button', { name: /^Dónde buscar:/ }).click();
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(page.getByRole('radio', { name: /más cercana/ })).toBeVisible();
    expectSame('con ubicación');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Cambiar de opción, de radio o de opción otra vez: ninguna solicitud nueva.
    await choose(page.getByRole('radio', { name: 'Todo en una tienda' }));
    await page.getByRole('button', { name: /^Dónde buscar: Cerca de mí/ }).click();
    await choose(page.getByRole('radio', { name: '0,5 km' }));
    await page.keyboard.press('Escape');
    await expect(page.getByRole('radiogroup', { name: 'Recomendaciones' })).toBeVisible();
    await choose(
      page.getByRole('radiogroup', { name: 'Recomendaciones' }).getByRole('radio').first(),
    );
    expectSame('tras cambiar opción y radio');

    // De vuelta a la canasta: tampoco se pide nada, y el área se conserva.
    await page.getByRole('link', { name: 'Volver' }).click();
    await expect(summaryOf(page).getByRole('link', { name: 'Ver dónde comprar' })).toBeVisible();
    await expect(summaryOf(page).getByText(/^Cerca de mí/)).toBeVisible();
    expectSame('al volver a la canasta');
  });
});

// Evidencia visual (solo con CANASTA_EVIDENCIA): con ubicación, varias opciones; y sin tienda con todo.
// Las capturas van a esa carpeta, que debe quedar fuera del repo.
for (const size of SIZES.filter(({ width }) => [360, 768, 1440].includes(width))) {
  test.describe(`evidencia con ubicación a ${size.name}`, () => {
    test.skip(!EVIDENCIA, 'Solo con CANASTA_EVIDENCIA');
    test.use({ viewport: { width: size.width, height: size.height } });

    test('con ubicación: varias opciones', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 4.5439, longitude: -75.6811 });
      await seed(page, 'valora:donde', 'ubicacion');
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await fakeApi(page);
      await page.goto(WHERE);
      await expect(page.getByRole('radio', { name: /más cercana/ })).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      await shot(page, `donde-comprar-${size.name}-con-ubicacion.png`);
    });

    test('sin tienda con todo dentro del radio', async ({ page, context }) => {
      const original = PRODUCTS.slice(0, 3).map((p) => p.prices);
      const prices = [
        [1_234_567, 1_300_000, null],
        [null, 3900, null],
        [15_000, null, 12_000],
      ];
      PRODUCTS.slice(0, 3).forEach((p, i) => {
        p.prices = prices[i] ?? p.prices;
      });
      try {
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: 4.5339, longitude: -75.6811 });
        await seed(page, 'valora:donde', 'ubicacion');
        await seed(page, 'valora:radio', '0.5');
        await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
        await fakeApi(page);
        await page.goto(WHERE);
        await expect(
          page.getByText(/ninguna tienda sola tiene toda tu lista/i).first(),
        ).toBeVisible();
        expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
        await shot(page, `donde-comprar-${size.name}-sin-tienda-con-todo.png`);
      } finally {
        PRODUCTS.slice(0, 3).forEach((p, i) => {
          p.prices = original[i] ?? p.prices;
        });
      }
    });
  });
}
