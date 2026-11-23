import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { basketOf, fakeApi, PRODUCTS, savedPlan, seed } from './support/planFake';
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
    await expect(page.getByRole('button', { name: 'Guardar lista' })).toBeVisible();
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
    if (EVIDENCIA) {
      mkdirSync(EVIDENCIA, { recursive: true });
      await page.screenshot({ path: join(EVIDENCIA, `canasta-${size.name}.png`), fullPage: true });
    }
    expect(problemas, `problemas en /canasta a ${size.name}`).toEqual([]);
  });
}

// «Dónde comprar»: el panel de la canasta con las tarjetas de recomendación. A la derecha de la lista en
// computador (desde 960 px) y debajo de ella en tableta y celular, con el foco en el orden en que se ve.
// Con CANASTA_EVIDENCIA se guarda una captura (escala 1) del panel por estado.
const WIDE = 960;

// Lo que se puede tocar dentro del panel y mide menos de 24 px (WCAG 2.5.8). Las casillas de radio
// van escondidas dentro de su tarjeta o ficha: se mide la etiqueta.
const smallTargets = (panel: Locator) =>
  panel.evaluate((root, min) => {
    const small: string[] = [];
    for (const el of root.querySelectorAll(
      'a[href], button, summary, input, label.category-chip, label.rec-card',
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

// Dónde está cada elemento que recibe el foco con Tab, desde el primer producto hasta el final del panel.
const tabStops = async (page: Page) => {
  await page.locator('.basket-row').first().getByRole('checkbox').focus();
  const stops: { inPanel: boolean; cy: number; name: string }[] = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el?.closest('main')) return null;
      // La casilla de radio va escondida: lo que se ve es su tarjeta.
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

    test('el panel con sus tarjetas queda a la derecha (computador) o debajo (tableta y celular)', async ({
      page,
    }) => {
      const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
      const cards = panel.getByRole('radiogroup', { name: 'Recomendaciones' });
      await expect(cards).toBeVisible();
      for (const name of ['La más barata', 'Todo en una tienda'])
        await expect(cards.locator('label.rec-card', { hasText: name }).first()).toBeVisible();
      await expect(cards.getByRole('radio', { name: 'La más barata' })).toBeChecked();
      await expect(panel.getByText('Comparte tu ubicación para ver la más cercana.')).toBeVisible();
      await expect(page.locator('main').getByRole('complementary')).toHaveCount(1);
      const [p, l] = [await box(panel), await box(page.locator('.basket'))];
      if (size.width >= WIDE)
        expect(p.x, 'panel a la derecha de la lista').toBeGreaterThan(l.x + l.width);
      else expect(p.y, 'panel debajo de la lista').toBeGreaterThanOrEqual(l.y + l.height - 1);
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(panel), 'objetivos menores de 24 px').toEqual([]);
      if (size.width < 600) {
        const card = await box(cards.locator('label.rec-card').first());
        expect(card.height, 'tarjeta de 44 px en celular').toBeGreaterThanOrEqual(44);
      }
      if (EVIDENCIA) {
        await shot(page, `panel-${size.name}-sin-ubicacion.png`);
        if (size.width === 1440) {
          await page.emulateMedia({ colorScheme: 'dark' });
          await shot(page, `panel-${size.name}-sin-ubicacion-oscuro.png`);
        }
      }
    });

    test('«Todo en una tienda» conserva la tarjeta naranja; la más barata muestra tiendas con «Cómo llegar» y el traslado plegado', async ({
      page,
    }) => {
      const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
      const ways = panel.getByRole('link', { name: /^Cómo llegar a/ });
      await expect(ways.first()).toBeVisible();
      expect(await ways.count()).toBeGreaterThanOrEqual(2);
      const fold = panel.getByText('Traslado y domicilio (estimado)');
      await expect(fold).toBeVisible();
      const how = panel.getByText(/^Cómo estimamos esto:/);
      await expect(how).toBeHidden();
      await fold.click();
      await expect(how).toBeVisible();
      await expect(panel.getByText('Factor de rodeo')).toHaveCount(0);
      await panel.getByText('¿Cuánto te cuesta ir?').click();
      await expect(panel.getByRole('radio', { name: 'Voy a pie' })).toBeChecked();
      await expect(panel.getByRole('button', { name: 'Guardar lista' })).toBeVisible();
      await expect(panel.getByRole('link', { name: /plan completo/ })).toHaveCount(0);
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(panel), 'objetivos menores de 24 px').toEqual([]);
      await choose(panel.getByRole('radio', { name: 'Todo en una tienda' }));
      await expect(panel.getByText('Compra todo en')).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(panel), 'objetivos menores de 24 px').toEqual([]);
      if (EVIDENCIA) await shot(page, `panel-${size.name}-todo-en-una-tienda.png`);
    });

    test('las flechas cambian de tarjeta sin saltarse ninguna', async ({ page }) => {
      const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
      await panel.getByRole('radio', { name: 'La más barata' }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(panel.getByRole('radio', { name: 'Todo en una tienda' })).toBeChecked();
      await expect(panel.getByRole('radio', { name: 'Todo en una tienda' })).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(panel.getByRole('radio', { name: 'La más barata' })).toBeChecked();
    });

    test('el orden de foco es el orden visual: la lista y luego el panel', async ({ page }) => {
      test.skip(size.width >= WIDE, 'En computador son dos columnas, de izquierda a derecha');
      await expect(page.getByRole('radio', { name: 'La más barata' })).toBeVisible();
      const stops = await tabStops(page);
      const inPanel = stops.filter((s) => s.inPanel);
      expect(inPanel.length, 'el panel recibe el foco').toBeGreaterThanOrEqual(3);
      expect(stops.at(-1)?.inPanel, 'el recorrido termina en el panel').toBe(true);
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

// Casos extremos de «Dónde comprar» que antes se revisaban en /canasta/plan: valores enormes, sin
// precios, con error, al cambiar de ancho, con ubicación y con las guardadas llenas. Todo vive en
// /canasta: sin desborde horizontal y con objetivos táctiles de 24 px o más dentro del panel.
for (const size of SIZES) {
  test.describe(`«Dónde comprar», casos extremos a ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    const panelOf = (page: Page) => page.getByRole('complementary', { name: 'Dónde comprar' });

    test('con domicilio y pasaje de valores enormes y un producto sin precio', async ({ page }) => {
      await seed(page, 'valora:canasta', basketOf(PRODUCTS));
      await fakeApi(page);
      await page.goto('/canasta');
      const panel = panelOf(page);
      await expect(panel.getByRole('radio', { name: 'La más barata' })).toBeChecked();
      await expect(
        panel.getByText(/Sin precio vigente cerca: Producto que nadie vende/),
      ).toBeVisible();
      await panel.getByRole('switch', { name: 'Me lo llevan a casa' }).first().check();
      await panel.getByLabel('¿Cuánto cobra el domicilio?').first().fill('1234567');
      // «¿Cuánto te cuesta ir?» va plegada: se abre y se elige «Pago pasaje».
      await panel.getByText('¿Cuánto te cuesta ir?').click();
      await choose(panel.getByRole('radio', { name: 'Pago pasaje' }));
      await panel.getByLabel('Pasaje por viaje (COP)').fill('1500');
      await expect(panel.getByRole('button', { name: 'Guardar lista' })).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(panel), 'objetivos menores de 24 px').toEqual([]);
      if (EVIDENCIA) await shot(page, `extremos-${size.name}.png`);
    });

    test('sin precios cerca o con error, lo dice y deja guardar la lista', async ({ page }) => {
      await seed(page, 'valora:canasta', basketOf(PRODUCTS));
      await fakeApi(page, 'empty');
      await page.goto('/canasta');
      const panel = panelOf(page);
      await expect(
        panel.getByText(/Ningún producto de tu canasta tiene precio vigente/),
      ).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Guardar solo la lista' })).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(panel), 'objetivos menores de 24 px').toEqual([]);
      if (EVIDENCIA) await shot(page, `sin-precio-${size.name}.png`);
      await page.unrouteAll();
      await fakeApi(page, 'error');
      await page.reload();
      await expect(panel.getByText('No pudimos calcular dónde te sale más barata.')).toBeVisible();
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
      await page.goto('/canasta');
      const panel = panelOf(page);
      await expect(panel.getByRole('radio', { name: /más cercana/ })).toBeVisible();
      await panel.getByRole('button', { name: 'Guardar lista' }).click();
      await expect(panel.getByText('Lista guardada')).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Guardadas (2)' })).toBeVisible();
      // El radio vive dentro del «¿Dónde?»: se abre (popover, o hoja inferior en celular) para verlo.
      await panel.getByRole('button', { name: /^Dónde buscar: Cerca de mí/ }).click();
      await expect(page.getByText('Radio').first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      expect(await smallTargets(panel), 'objetivos menores de 24 px').toEqual([]);
      if (EVIDENCIA) await shot(page, `ubicacion-guardada-${size.name}.png`);
    });

    test('con 20 listas guardadas avisa que está lleno y lleva a «Guardadas»', async ({ page }) => {
      const plans = Array.from({ length: 20 }, (_, i) => savedPlan(`plan-${String(i)}`, 2));
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await seed(page, 'valora:planes', { v: 1, plans });
      await fakeApi(page);
      await page.goto('/canasta');
      const panel = panelOf(page);
      await panel.getByRole('button', { name: 'Guardar lista' }).click();
      await expect(panel.getByText(/Ya tienes 20 listas guardadas/)).toBeVisible();
      await panel.getByRole('link', { name: 'Ir a Guardadas' }).click();
      await expect(page).toHaveURL(/\/canasta\?tab=guardadas$/);
      await expect(page.getByRole('tab', { name: 'Guardadas (20)' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
    });
  });
}

test('cambiar de ancho conserva los supuestos del panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
  await fakeApi(page);
  await page.goto('/canasta');
  const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
  await panel.getByText('¿Cuánto te cuesta ir?').click();
  await choose(panel.getByRole('radio', { name: 'Pago pasaje' }));
  await panel.getByLabel('Pasaje por viaje (COP)').fill('1500');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByLabel('Pasaje por viaje (COP)')).toHaveValue('1500');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
});

for (const size of [SIZES[0], SIZES[5]]) {
  if (!size) continue;
  test(`/canasta en modo oscuro a ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ colorScheme: 'dark' });
    await seed(page, 'valora:canasta', basketOf(PRODUCTS));
    await fakeApi(page);
    await page.goto('/canasta');
    const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
    await expect(panel.getByRole('radio', { name: 'La más barata' })).toBeChecked();
    expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
    expect(await smallTargets(panel), 'objetivos menores de 24 px').toEqual([]);
    if (EVIDENCIA) await shot(page, `oscuro-${size.name}.png`);
  });
}

// ADR-031: la consulta es siempre por municipio y con la misma URL para todos (caché compartida); la
// cercanía se calcula en el dispositivo. Con N productos hay exactamente N solicitudes a /comparison,
// todas con la misma query, sin lat ni lng, también con «Cerca de mí», y cambiar de tarjeta o de radio
// no hace ninguna más.
test.describe('«Dónde comprar»: solicitudes', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  const QUERY = 'municipality=armenia&sort=unit_price&onlyCurrent=true';
  // La CI compila el frontend con NODE_ENV=development (el backend lo necesita en ese trabajo): React
  // corre con StrictMode y monta los efectos dos veces, así que cada producto se pide dos veces en el
  // mismo instante. En producción es una vez. Lo que vigila el ADR-035 es que no se pida NADA más al
  // activar la ubicación, cambiar de tarjeta o de radio, y que nunca viajen lat ni lng.
  const MOUNTS = process.env['NODE_ENV'] === 'development' ? 2 : 1;

  test('N productos, N solicitudes con la misma URL y ninguna con lat/lng, aun con «Cerca de mí»', async ({
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
    const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
    await expect(panel.getByRole('radio', { name: 'La más barata' })).toBeChecked();

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
    expectSame('por municipio');

    // «Cerca de mí»: la ubicación se usa solo en el dispositivo.
    await panel.getByRole('button', { name: /^Dónde buscar:/ }).click();
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(panel.getByRole('radio', { name: /más cercana/ })).toBeVisible();
    expectSame('con ubicación');

    // Cambiar de tarjeta, de radio o de tarjeta otra vez: ninguna solicitud nueva.
    await choose(panel.getByRole('radio', { name: 'Todo en una tienda' }));
    await panel.getByRole('button', { name: /^Dónde buscar: Cerca de mí/ }).click();
    await choose(page.getByRole('radio', { name: '0,5 km' }));
    await page.keyboard.press('Escape');
    await expect(panel.getByRole('radiogroup', { name: 'Recomendaciones' })).toBeVisible();
    await choose(
      panel.getByRole('radiogroup', { name: 'Recomendaciones' }).getByRole('radio').first(),
    );
    expectSame('tras cambiar tarjeta y radio');
  });
});

// Evidencia visual (solo con CANASTA_EVIDENCIA): con ubicación, varias tarjetas; y sin tienda con todo.
// Las capturas van a esa carpeta, que debe quedar fuera del repo.
for (const size of SIZES.filter(({ width }) => [360, 768, 1440].includes(width))) {
  test.describe(`evidencia con ubicación a ${size.name}`, () => {
    test.skip(!EVIDENCIA, 'Solo con CANASTA_EVIDENCIA');
    test.use({ viewport: { width: size.width, height: size.height } });

    test('con ubicación: varias tarjetas', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 4.5439, longitude: -75.6811 });
      await seed(page, 'valora:donde', 'ubicacion');
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await fakeApi(page);
      await page.goto('/canasta');
      const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
      await expect(panel.getByRole('radio', { name: /más cercana/ })).toBeVisible();
      expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
      await shot(page, `panel-${size.name}-con-ubicacion.png`);
      if (size.width === 1440) {
        await page.emulateMedia({ colorScheme: 'dark' });
        await shot(page, `panel-${size.name}-con-ubicacion-oscuro.png`);
      }
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
        await page.goto('/canasta');
        const panel = page.getByRole('complementary', { name: 'Dónde comprar' });
        await expect(
          panel.getByText(/ninguna tienda sola tiene toda tu lista/i).first(),
        ).toBeVisible();
        expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
        await shot(page, `panel-${size.name}-sin-tienda-con-todo.png`);
      } finally {
        PRODUCTS.slice(0, 3).forEach((p, i) => {
          p.prices = original[i] ?? p.prices;
        });
      }
    });
  });
}
