import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expectNoSeriousAxe,
  nestedScrollers,
  noOverflow,
  focusOrderProblems,
  SEVEN_SIZES,
  smallTargets,
  tabStops,
  upwardJumps,
} from './support/layout';
import { quietStorage, richApi } from './support/richFake';

// Regresión permanente: Inicio, mapa, detalle de producto y ficha de tienda (con datos parecidos a los
// reales: nombres largos, promoción, 7 tiendas, 16 productos) no tienen ningún contenedor con scroll
// propio que de verdad desplace, ni vertical ni horizontal, en 360, 390, 768 y los portátiles de 14" y
// 16". Antes: el panel `.side` del mapa (1.135 px en cajas de 616 a 1.013 px) y del detalle (756 px en
// 616 y 664) se desplazaban por dentro, y las categorías del Inicio eran un renglón de 825 px escondido
// en 328 a 736 px. La canasta tiene su propia prueba (canasta-sin-scroll-anidado). Sin backend.
interface Screen {
  name: string;
  path: string;
  // Algo que solo existe cuando la pantalla terminó de cargar.
  ready: (page: Page) => Locator;
  // Cómo se recorre con Tab: `panelLast` = el panel viene después de lo principal (mapa); si no, el
  // panel va entre el encabezado y el listado (detalle y ficha de tienda).
  focus: 'panelLast' | 'panelBetween' | 'none';
  start?: (page: Page) => Locator;
}

const back = (page: Page) => page.getByRole('link', { name: 'Volver' });
const SCREENS: Screen[] = [
  {
    name: 'Inicio',
    path: '/',
    ready: (page) => page.getByRole('radiogroup', { name: 'Categoría' }),
    focus: 'none',
  },
  {
    name: 'Mapa',
    path: '/mapa',
    ready: (page) => page.locator('.store-cards li').nth(6),
    focus: 'panelLast',
    start: (page) => page.locator('main button').first(),
  },
  {
    name: 'Detalle de producto',
    path: '/productos/p-1',
    ready: (page) => page.locator('.cheapest-card:not(.loading)'),
    focus: 'panelBetween',
    start: back,
  },
  {
    name: 'Detalle con promoción',
    path: '/productos/p-3',
    ready: (page) => page.locator('.cheapest-card:not(.loading)'),
    focus: 'panelBetween',
    start: back,
  },
  {
    name: 'Detalle sin precios',
    path: '/productos/p-16',
    ready: (page) => page.getByRole('heading', { level: 1 }),
    focus: 'none',
  },
  {
    name: 'Ficha de tienda larga',
    path: '/tiendas/e-1',
    ready: (page) => page.locator('.store-offer').first(),
    focus: 'panelBetween',
    start: back,
  },
  {
    name: 'Ficha de tienda corta',
    path: '/tiendas/e-3',
    ready: (page) => page.locator('.store-offer').first(),
    focus: 'panelBetween',
    start: back,
  },
];

for (const size of SEVEN_SIZES) {
  test.describe(`sin scroll anidado a ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    const wide = size.width >= 960;
    for (const screen of SCREENS) {
      test(screen.name, async ({ page }) => {
        await quietStorage(page);
        await richApi(page);
        await page.goto(screen.path);
        await expect(screen.ready(page)).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(page.getByRole('main').getByRole('complementary')).toHaveCount(1);

        expect(await nestedScrollers(page), 'contenedores con scroll propio').toEqual([]);
        expect(await noOverflow(page), 'desborde horizontal de la página').toBe(true);
        expect(await smallTargets(page, 'main'), 'objetivos menores de 24 px').toEqual([]);
        await expectNoSeriousAxe(page);

        // Un panel solo es fijo si cabe entero en la ventana; si no, fluye con la página.
        const panel = await page.evaluate(() => {
          const side = document.querySelector('main aside.side');
          if (!side) return null;
          return {
            sticky: getComputedStyle(side).position === 'sticky',
            height: side.getBoundingClientRect().height,
            viewport: window.innerHeight,
          };
        });
        expect(panel, 'el panel lateral').not.toBeNull();
        if (panel?.sticky) {
          expect(wide, 'fijo solo en computador').toBe(true);
          expect(panel.height, 'un panel fijo cabe en la ventana').toBeLessThanOrEqual(
            panel.viewport - 88 - 16,
          );
        }
        if (screen.name === 'Mapa') expect(panel?.sticky, 'la lista del mapa fluye').toBe(false);

        if (screen.focus === 'none' || !screen.start) return;
        const start = screen.start(page);
        if (screen.focus === 'panelLast') {
          expect(await focusOrderProblems(page, start, 30), 'orden de foco').toEqual([]);
          // Los pines del mapa no estorban al teclado: la lista de tiendas es su camino.
          await expect(page.locator('.leaflet-marker-icon[tabindex]')).toHaveCount(0);
        } else {
          const stops = await tabStops(page, start);
          expect(stops.length, 'paradas de Tab').toBeGreaterThan(5);
          if (wide) {
            // La columna principal y el panel van cada uno de arriba abajo.
            expect(
              upwardJumps(
                stops.filter((s) => !s.inAside),
                30,
              ),
              'columna principal',
            ).toEqual([]);
            expect(
              upwardJumps(
                stops.filter((s) => s.inAside),
                30,
              ),
              'panel',
            ).toEqual([]);
          } else {
            // En celular y tableta el panel va entre el encabezado y el listado, y el foco también.
            expect(upwardJumps(stops, 30), 'orden de foco = orden visual').toEqual([]);
          }
          expect(
            stops.filter((s) => s.covered).map((s) => s.name),
            'foco tapado por la barra superior',
          ).toEqual([]);
        }
        expect(await nestedScrollers(page), 'contenedores con scroll propio al final').toEqual([]);
      });
    }
  });
}

// Inicio: las categorías pasan a varias líneas, todas enteras a la vista y sin flecha escondida.
for (const size of SEVEN_SIZES) {
  test(`las categorías del Inicio se ven enteras a ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await quietStorage(page);
    await richApi(page);
    await page.goto('/');
    const group = page.getByRole('radiogroup', { name: 'Categoría' });
    await expect(group.locator('label')).toHaveCount(CATEGORY_COUNT);
    const fit = await group.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        hidden: el.scrollWidth > el.clientWidth,
        outside: [...el.querySelectorAll('label')]
          .filter((chip) => {
            const r = chip.getBoundingClientRect();
            return r.left < box.left - 1 || r.right > box.right + 1;
          })
          .map((chip) => chip.textContent),
        lines: new Set([...el.querySelectorAll('label')].map((c) => c.offsetTop)).size,
      };
    });
    expect(fit.hidden, 'contenido más ancho que la caja').toBe(false);
    expect(fit.outside, 'chips fuera de la caja').toEqual([]);
    expect(fit.lines, 'una sola fila escondería chips: pasan a varias líneas').toBeGreaterThan(1);
    await expect(page.locator('.chip-arrow')).toHaveCount(0);
  });
}

// «Todo» más las categorías de la escena falsa.
const CATEGORY_COUNT = 10;
