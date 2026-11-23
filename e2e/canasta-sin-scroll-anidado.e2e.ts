import { expect, test } from '@playwright/test';
import {
  expectNoSeriousAxe,
  focusOrderProblems,
  LAPTOPS,
  nestedScrollers,
  noOverflow,
  SIZES,
  smallTargets,
} from './support/layout';
import { basketOf, fakeApi, PRODUCTS, seed } from './support/planFake';

// Regresión: /canasta y /canasta/donde-comprar no tienen ningún contenedor con scroll propio que de
// verdad desplace (ni vertical ni horizontal), en los tamaños de siempre y en los portátiles de 14" y
// 16" (1280×720, 1366×768, 1536×864 y 1728×1117), con 3 productos y con la lista larga de planFake.
// Antes, el panel lateral de «Dónde comprar» se desplazaba por dentro (1.790 px en una caja de 616 px) y
// las fichas de «¿Cuánto te cuesta ir?» se cortaban con una barra escondida. Sin backend: /v1 es falso.
const BASKETS = [
  { name: '3 productos', items: () => basketOf(PRODUCTS.slice(0, 3)) },
  { name: 'lista larga', items: () => basketOf(PRODUCTS) },
];
const PAGES = [
  { path: '/canasta', ready: 'Ver dónde comprar' },
  { path: '/canasta/donde-comprar', ready: 'Guardar lista' },
];

for (const size of [...SIZES, ...LAPTOPS]) {
  test.describe(`sin scroll anidado a ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const basket of BASKETS) {
      for (const where of PAGES) {
        test(`${where.path} con ${basket.name}`, async ({ page }) => {
          await seed(page, 'valora:canasta', basket.items());
          await fakeApi(page);
          await page.goto(where.path);
          const action = page.getByRole(where.ready === 'Guardar lista' ? 'button' : 'link', {
            name: where.ready,
          });
          await expect(action).toBeVisible();

          expect(await nestedScrollers(page), 'contenedores con scroll propio').toEqual([]);
          expect(await noOverflow(page), 'desborde horizontal de la página').toBe(true);
          expect(await smallTargets(page, 'main'), 'objetivos menores de 24 px').toEqual([]);
          await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
          await expect(page.getByRole('main').getByRole('complementary')).toHaveCount(1);
          await expectNoSeriousAxe(page);

          // En computador, lo principal se alcanza sin desplazar la página ni el panel.
          if (size.width >= 960) {
            await expect(action).toBeInViewport({ ratio: 1 });
            await page.evaluate(() => {
              window.scrollTo(0, document.documentElement.scrollHeight);
            });
            // El panel lateral es fijo: sigue entero a la vista aunque la página baje.
            await expect(action).toBeInViewport({ ratio: 1 });
            await page.evaluate(() => {
              window.scrollTo(0, 0);
            });
          }

          const start =
            where.path === '/canasta'
              ? page.locator('.basket-row').first().getByRole('checkbox')
              : page.getByRole('link', { name: 'Volver' });
          expect(
            await focusOrderProblems(page, start, where.path === '/canasta' ? 30 : 4),
            'orden de foco',
          ).toEqual([]);
          expect(await nestedScrollers(page), 'contenedores con scroll propio al final').toEqual(
            [],
          );
        });
      }
    }
  });
}
