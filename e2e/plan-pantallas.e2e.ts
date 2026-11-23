import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { basketOf, fakeApi, PRODUCTS, savedPlan, seed } from './support/planFake';

// Lo que sigue siendo cierto de las pantallas del plan de compra: la lista guardada abierta
// (/canasta/plan/:id) en computador, tableta y celular, y que la dirección vieja (/canasta/plan) ya no
// es una pantalla sino que aterriza en /canasta. El resto (recomendaciones, supuestos, guardar) vive
// en /canasta y se prueba en canasta-pantallas.e2e.ts y listas-guardadas.e2e.ts.
// Sin desbordamiento horizontal, objetivos táctiles de 24 px o más (WCAG 2.5.8) y un solo h1. Sin
// backend: todo /v1 es falso. Con PLAN_EVIDENCIA se guarda una captura (escala 1) de cada tamaño en
// esa carpeta, que debe quedar fuera del repo.
const EVIDENCIA = process.env['PLAN_EVIDENCIA'];
const SIZES = [
  { name: 'pc-1440', width: 1440, height: 900 },
  { name: 'pc-1280', width: 1280, height: 800 },
  { name: 'tableta-820', width: 820, height: 1180 },
  { name: 'tableta-768', width: 768, height: 1024 },
  { name: 'tableta-horizontal-1180', width: 1180, height: 820 },
  { name: 'celular-390', width: 390, height: 844 },
  { name: 'celular-360', width: 360, height: 740 },
];
const MIN_TARGET = 24;

// Lo que se mide dentro de la página: desborde horizontal y objetivos táctiles chicos.
function audit(page: Page, scope: string) {
  return page.evaluate(
    ([min, root]) => {
      const vw = document.documentElement.clientWidth;
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0';
      };
      const label = (el: Element) =>
        `<${el.tagName.toLowerCase()}> «${(el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 40)}»`;
      // Un contenedor con scroll propio a propósito no cuenta como desborde de la página.
      const scrolls = (el: Element) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true;
        }
        return false;
      };
      const overflow: string[] = [];
      const doc = document.documentElement;
      if (doc.scrollWidth > vw)
        overflow.push(`página: scrollWidth ${String(doc.scrollWidth)} > ${String(vw)}`);
      for (const el of document.querySelectorAll('main *')) {
        const r = el.getBoundingClientRect();
        if (visible(el) && r.right > vw + 1 && !scrolls(el))
          overflow.push(`${label(el)} termina en ${String(Math.round(r.right))} > ${String(vw)}`);
      }
      const small: string[] = [];
      for (const el of document.querySelectorAll(
        `${root} :is(a[href], button, select, summary, input)`,
      )) {
        if (!visible(el)) continue;
        // Un enlace dentro de una frase está exento (WCAG 2.5.8, excepción «en línea»).
        if (
          el.tagName === 'A' &&
          el.parentElement?.tagName === 'P' &&
          el.parentElement.childNodes.length > 1
        )
          continue;
        const r = el.getBoundingClientRect();
        if (r.width < min || r.height < min)
          small.push(`${label(el)} ${String(Math.round(r.width))}×${String(Math.round(r.height))}`);
      }
      return { overflow, small };
    },
    [MIN_TARGET, scope] as const,
  );
}

// `scope`: dónde se miden los objetivos táctiles.
async function check(page: Page, shot: string, size: string, keyTexts: string[], scope = 'main') {
  for (const text of keyTexts) await expect(page.getByText(text).first()).toBeVisible();
  const { overflow, small } = await audit(page, scope);
  if (EVIDENCIA) {
    mkdirSync(EVIDENCIA, { recursive: true });
    await page.screenshot({ path: join(EVIDENCIA, `${shot}-${size}.png`), fullPage: true });
  }
  expect(overflow, `desborde horizontal en ${shot} a ${size}`).toEqual([]);
  expect(small, `objetivos menores de ${String(MIN_TARGET)} px en ${shot} a ${size}`).toEqual([]);
}

for (const size of SIZES) {
  test.describe(`a ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('/canasta/plan/:id: lista guardada con 5 tiendas', async ({ page }) => {
      await seed(page, 'valora:planes', { v: 1, plans: [savedPlan('plan-cinco')] });
      await fakeApi(page);
      await page.goto('/canasta/plan/plan-cinco');
      await expect(page.getByRole('heading', { level: 1, name: 'Lista guardada' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await check(page, 'plan-guardado', size.name, [
        'Totales',
        'Compartir',
        'Descargar',
        'Imprimir',
        'Usar esta lista',
        'Borrar esta lista',
      ]);
      await expect(page.getByText(/Armar de nuevo|Recalcular/)).toHaveCount(0);
    });
  });
}

test.describe('la dirección vieja del plan', () => {
  test('/canasta/plan aterriza en /canasta, con un solo h1', async ({ page }) => {
    await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
    await fakeApi(page);
    await page.goto('/canasta/plan');
    await expect(page).toHaveURL(/\/canasta$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mi canasta' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('complementary', { name: 'Dónde comprar' })).toBeVisible();
    // El botón «Atrás» no regresa a la dirección vieja: se reemplazó.
    await page.goBack();
    await expect(page).not.toHaveURL(/\/canasta\/plan/);
  });

  test('/canasta/plan#mis-planes aterriza en la pestaña «Guardadas»', async ({ page }) => {
    await seed(page, 'valora:planes', { v: 1, plans: [savedPlan('plan-uno', 2)] });
    await fakeApi(page);
    await page.goto('/canasta/plan#mis-planes');
    await expect(page).toHaveURL(/\/canasta\?tab=guardadas$/);
    await expect(page.getByRole('tab', { name: 'Guardadas (1)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

test.describe('desde la lista guardada', () => {
  test('«Usar esta lista» la carga y lleva a «Mi lista» con el aviso', async ({ page }) => {
    await seed(page, 'valora:planes', { v: 1, plans: [savedPlan('plan-uno', 2)] });
    await fakeApi(page);
    await page.goto('/canasta/plan/plan-uno');
    await page.getByRole('button', { name: /^Usar esta lista/ }).click();
    await expect(page).toHaveURL(/\/canasta$/);
    await expect(page.getByText(/^Listo: cargamos «.*» en tu canasta$/)).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Mi lista' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('con productos en la canasta pregunta antes de usarla', async ({ page }) => {
    await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 1)));
    await seed(page, 'valora:planes', { v: 1, plans: [savedPlan('plan-uno', 2)] });
    await fakeApi(page);
    await page.goto('/canasta/plan/plan-uno');
    await page.getByRole('button', { name: /^Usar esta lista/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Reemplazar mi lista' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Agregar a mi lista' }).click();
    await expect(page).toHaveURL(/\/canasta$/);
    await expect(page.getByText(/^Listo: agregamos «.*» a tu canasta$/)).toBeVisible();
  });

  test('«Borrar esta lista» vuelve a «Guardadas»', async ({ page }) => {
    await seed(page, 'valora:planes', { v: 1, plans: [savedPlan('plan-uno', 2)] });
    await fakeApi(page);
    await page.goto('/canasta/plan/plan-uno');
    await page.getByRole('button', { name: 'Borrar esta lista' }).click();
    await expect(page).toHaveURL(/\/canasta\?tab=guardadas$/);
    await expect(
      page.getByRole('heading', { name: 'Aún no tienes listas guardadas' }),
    ).toBeVisible();
  });
});
