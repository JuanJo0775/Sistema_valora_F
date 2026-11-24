import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expectNoSeriousAxe,
  nestedScrollers,
  noOverflow,
  SEVEN_SIZES,
  smallTargets,
  tabStops,
  upwardJumps,
} from './support/layout';
import { quietStorage, richApi, STORE_E2_UUID } from './support/richFake';

// Seis decisiones de diseño de la auditoría con datos parecidos a los reales (richFake): Registrar
// precio con «Enviar» a la vista, un solo «Agregar a la canasta» en celular, Historial con resumen y
// gráfica ancha, ficha de tienda con el nombre en una fila completa y la lista de municipios con un solo
// scroll y dos columnas en portátil. Siete tamaños, sin backend.

const REGISTER = `/registrar?producto=p-1&tienda=${STORE_E2_UUID}`;

// El elemento se ve entero dentro de la ventana, sin desplazar, y nada lo tapa.
async function fullyVisible(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      inside: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= innerWidth,
      uncovered: Boolean(top && (el === top || el.contains(top))),
      scrollY: window.scrollY,
    };
  });
}

const prepare = async (page: Page, session = false) => {
  await quietStorage(page);
  await richApi(page, { session });
};

for (const size of SEVEN_SIZES) {
  test.describe(`pulido de pantallas a ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    const phone = size.width < 960;

    test('Registrar precio: tienda en una fila y «Enviar» a la vista sin desplazar', async ({
      page,
    }) => {
      await prepare(page, true);
      await page.goto(REGISTER);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Arroz blanco Premium/);
      // ?tienda=<UUID> deja la tienda elegida: una sola fila con «Cambiar».
      const row = page.getByRole('group', { name: 'Tienda' });
      await expect(row).toContainText('Tienda Don Pepe');
      await expect(row.getByRole('button', { name: /^Cambiar/ })).toBeVisible();
      await expect(page.getByRole('radio', { name: /Tienda Don Pepe/ })).toHaveCount(0);

      const send = page.getByRole('button', { name: 'Enviar' });
      const seen = await fullyVisible(page, send);
      expect(seen, '«Enviar» entero en la ventana sin desplazar').toEqual({
        inside: true,
        uncovered: true,
        scrollY: 0,
      });
      // En celular y tableta es una barra fija sobre la barra de navegación; en computador, del flujo.
      const bar = await page.locator('.report-bar').evaluate((el) => ({
        fixed: getComputedStyle(el).position === 'fixed',
        bottom: el.getBoundingClientRect().bottom,
        tabbar: document.querySelector('.tabbar')?.getBoundingClientRect().top ?? 0,
      }));
      expect(bar.fixed).toBe(phone);
      if (phone) expect(bar.bottom, 'sobre la barra de navegación').toBeLessThanOrEqual(bar.tabbar);

      expect(await nestedScrollers(page), 'contenedores con scroll propio').toEqual([]);
      expect(await noOverflow(page), 'desborde horizontal').toBe(true);
      expect(await smallTargets(page, 'main'), 'objetivos menores de 24 px').toEqual([]);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expectNoSeriousAxe(page);

      // La nota del precio es una línea y el formato va plegado.
      await expect(page.locator('.price-help')).not.toHaveAttribute('open', '');
      // Con el teclado: el foco sigue el orden visual y nada queda tapado por la barra fija.
      const stops = await tabStops(page, row.getByRole('button', { name: /^Cambiar/ }));
      expect(stops.length).toBeGreaterThan(3);
      expect(upwardJumps(stops, 30), 'orden de foco = orden visual').toEqual([]);
      expect(
        stops.filter((s) => s.covered).map((s) => s.name),
        'foco tapado por la barra superior',
      ).toEqual([]);
    });

    test('Registrar precio: «Cambiar» abre el buscador sin scroll anidado', async ({ page }) => {
      await prepare(page, true);
      await page.goto(REGISTER);
      await page.getByRole('button', { name: /^Cambiar/ }).click();
      await expect(page.getByRole('searchbox', { name: 'Buscar tienda por nombre' })).toBeFocused();
      await page.getByRole('searchbox', { name: 'Buscar tienda por nombre' }).fill('tienda');
      await page.getByRole('button', { name: 'Buscar tienda' }).click();
      const exito = page.locator('label.choice.store', { hasText: 'Éxito Unicentro' });
      await expect(exito).toBeVisible();
      expect(await nestedScrollers(page), 'la lista de tiendas no se desplaza por dentro').toEqual(
        [],
      );
      expect(await noOverflow(page)).toBe(true);
      await exito.click();
      const row = page.getByRole('group', { name: 'Tienda' });
      await expect(row).toContainText('Éxito Unicentro');
      await expect(row.getByRole('button', { name: /^Cambiar/ })).toBeFocused();
    });

    test('Historial: título corto, resumen, gráfica ancha y tabla plegada', async ({ page }) => {
      await prepare(page);
      await page.goto('/productos/p-1/historial');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Historial de precios');
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('.history-product')).toContainText('Arroz blanco Premium');
      const cards = page.getByRole('list', { name: 'Resumen del periodo' }).getByRole('listitem');
      await expect(cards).toHaveCount(4);
      await expect(cards.nth(2)).toContainText(/Hoy|Último/);
      await expect(cards.nth(3)).toContainText(/Sube|Baja|Sin cambio/);

      const chart = page.getByRole('img', { name: /^Precio más bajo por día/ });
      await expect(chart).toBeVisible();
      const fill = await chart.evaluate((svg) => {
        const box = svg.getBoundingClientRect();
        const parent = (svg.parentElement as HTMLElement).getBoundingClientRect();
        return { ratio: box.width / parent.width, width: box.width };
      });
      // Desde 640 px la gráfica llena el ancho de la columna; en celular, también (no deja la mitad vacía).
      expect(fill.ratio, 'la gráfica usa el ancho disponible').toBeGreaterThan(0.9);

      const details = page.locator('details.history-table');
      await expect(details).not.toHaveAttribute('open', '');
      await expect(details.locator('summary')).toHaveText(/^Ver la tabla de precios \(\d+\)$/);

      expect(await nestedScrollers(page), 'cerrada').toEqual([]);
      expect(await noOverflow(page)).toBe(true);
      expect(await smallTargets(page, 'main')).toEqual([]);
      await expectNoSeriousAxe(page);
      await details.locator('summary').click();
      await expect(page.getByRole('table')).toBeVisible();
      expect(await nestedScrollers(page), 'abierta: sin scroll anidado en la tabla').toEqual([]);
      expect(await noOverflow(page)).toBe(true);
      await expectNoSeriousAxe(page);
    });

    test('Selector «¿Dónde buscar?»: un solo scroll y dos columnas en portátil', async ({
      page,
    }) => {
      await prepare(page);
      await page.goto('/');
      const trigger = page.locator('.where-trigger').first();
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: '¿Dónde buscar?' });
      await expect(dialog).toBeVisible();
      // Sin animación a medias (la hoja sube en 0,2 s): axe mide los colores ya asentados.
      await dialog.evaluate((el) =>
        Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
      );
      const list = dialog.getByRole('listbox', { name: 'Municipio' });
      await expect(list).toBeFocused();
      await expect(list.getByRole('option')).toHaveCount(12);

      const columns = await list.getByRole('option').evaluateAll((items) => {
        const lefts = new Set(items.map((item) => Math.round(item.getBoundingClientRect().left)));
        return lefts.size;
      });
      expect(columns, size.width >= 960 ? 'dos columnas' : 'una columna').toBe(
        size.width >= 960 ? 2 : 1,
      );
      expect(
        await list.evaluate((el) => getComputedStyle(el).maxHeight),
        'la lista no tiene alto propio',
      ).toBe('none');

      // Hasta 959 px la hoja (.overlay-body) es el único desplazamiento permitido; en portátil no hay.
      const scrollers = await nestedScrollers(page);
      if (size.width < 960) {
        expect(scrollers.filter((s) => !s.startsWith('div.overlay-body'))).toEqual([]);
        expect(scrollers.length).toBeLessThanOrEqual(1);
      } else {
        expect(scrollers, 'sin ningún scroll propio').toEqual([]);
      }
      expect(await noOverflow(page)).toBe(true);
      expect(await smallTargets(page, '[role=dialog]')).toEqual([]);
      await expectNoSeriousAxe(page);

      // El teclado sigue: Escape cierra y el foco vuelve al disparador.
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      // Elegir un municipio con el teclado cierra y lo deja elegido.
      await trigger.click();
      await page.getByRole('listbox', { name: 'Municipio' }).press('End');
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });

    test('Detalle de producto: un solo «Agregar a la canasta» y botón de registrar corto', async ({
      page,
    }) => {
      await prepare(page);
      await page.goto('/productos/p-1');
      await expect(page.locator('.cheapest-card:not(.loading)')).toBeVisible();
      const add = page.getByRole('button', { name: 'Agregar a la canasta' });
      await expect(add).toHaveCount(1);
      if (phone) {
        // Solo vive el de la barra fija: el del panel ni existe (sin foco ni lector de pantalla).
        await expect(page.locator('.action-bar').getByRole('button')).toHaveCount(1);
        await expect(page.locator('.side .add-to-basket > .btn')).toHaveCount(0);
        const seen = await fullyVisible(page, add);
        expect(seen.inside && seen.uncovered, 'la barra se ve y es operable').toBe(true);
        // Un solo foco en «Agregar a la canasta» y al final del contenido, donde se ve (abajo).
        await page.getByRole('link', { name: 'Volver' }).focus();
        const order: string[] = [];
        for (let i = 0; i < 60; i++) {
          await page.keyboard.press('Tab');
          order.push(
            await page.evaluate(() => {
              const el = document.activeElement;
              return `${el?.closest('main') ? 'main' : 'fuera'}|${(el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim().slice(0, 30)}`;
            }),
          );
        }
        const at = order.indexOf('fuera|Agregar a la canasta');
        expect(order.filter((name) => name.endsWith('|Agregar a la canasta'))).toHaveLength(1);
        expect(at, 'la barra recibe el foco').toBeGreaterThan(-1);
        expect(order.slice(0, at).some((name) => name.startsWith('main|Cómo llegar'))).toBe(true);
        expect(await smallTargets(page, '.action-bar'), 'objetivos de la barra').toEqual([]);
      } else {
        await expect(page.locator('.action-bar')).toHaveCount(0);
        await expect(
          page.locator('.side').getByRole('button', { name: 'Agregar a la canasta' }),
        ).toBeVisible();
      }
      // La presentación se elige en el panel, y lo elegido llega a la canasta.
      await page.locator('label.choice', { hasText: /^10 kg$/ }).click();
      const link = page.getByRole('link', { name: 'Registrar un precio de Arroz blanco Premium' });
      await expect(link).toHaveText('Registrar un precio');
      await add.click();
      await expect(
        page.getByRole('status').filter({ hasText: 'agregado a tu canasta' }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Quitar de mi canasta' })).toBeVisible();
      await expect(page.locator('.action-bar')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Agregar a la canasta' })).toHaveCount(0);
      expect(await nestedScrollers(page)).toEqual([]);
      expect(await noOverflow(page)).toBe(true);
    });

    test('Ficha de tienda: el nombre del producto no se parte en columnas estrechas', async ({
      page,
    }) => {
      await prepare(page);
      await page.goto('/tiendas/e-1');
      await expect(page.locator('.store-offer').first()).toBeVisible();
      const rows = await page.locator('.store-offer').evaluateAll((items) =>
        items.map((item) => {
          const name = (
            item.querySelector('.store-offer-body') as HTMLElement
          ).getBoundingClientRect();
          const price = (
            item.querySelector('.store-offer-price') as HTMLElement
          ).getBoundingClientRect();
          const box = item.getBoundingClientRect();
          const link = item.querySelector('h3 a') as HTMLElement;
          const lineHeight = parseFloat(getComputedStyle(link).lineHeight);
          return {
            nameWidth: name.width / box.width,
            priceBelow: price.top >= name.bottom - 1,
            lines: Math.round(link.getBoundingClientRect().height / lineHeight),
          };
        }),
      );
      if (size.width < 640) {
        for (const row of rows) {
          expect(row.nameWidth, 'el nombre ocupa la fila completa').toBeGreaterThan(0.85);
          expect(row.priceBelow, 'el precio va debajo').toBe(true);
          // Un nombre de 70 caracteres cabe en 4 líneas de una fila completa (antes, 5 a 9).
          expect(row.lines).toBeLessThanOrEqual(4);
        }
      }
      expect(await nestedScrollers(page)).toEqual([]);
      expect(await noOverflow(page)).toBe(true);
    });
  });
}
