import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { basketOf, fakeApi, PRODUCTS, savedPlan, seed } from './support/planFake';

// Pantallas del plan de compra (/canasta, /canasta/plan, /canasta/plan/:id) en computador, tableta
// y celular: sin desbordamiento horizontal, objetivos táctiles de 24 px o más (WCAG 2.5.8) y textos
// clave visibles. Sin backend: todo /v1 es falso. Con PLAN_EVIDENCIA se guarda una captura (escala 1)
// de cada pantalla y tamaño en esa carpeta, que debe quedar fuera del repo.
const EVIDENCIA = process.env['PLAN_EVIDENCIA'];
const SIZES = [
  { name: 'pc-1440', width: 1440, height: 900, onlyPlan: false },
  { name: 'pc-1280', width: 1280, height: 800, onlyPlan: false },
  { name: 'tableta-820', width: 820, height: 1180, onlyPlan: false },
  { name: 'tableta-768', width: 768, height: 1024, onlyPlan: false },
  { name: 'tableta-horizontal-1180', width: 1180, height: 820, onlyPlan: true },
  { name: 'celular-390', width: 390, height: 844, onlyPlan: false },
  { name: 'celular-360', width: 360, height: 740, onlyPlan: false },
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

// `scope`: dónde se miden los objetivos táctiles (en /canasta, solo la tarjeta lateral, que es lo que cubre esta prueba).
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
    test.beforeEach(async ({ page }) => {
      await seed(page, 'valora:canasta', basketOf(PRODUCTS));
    });

    test('/canasta: tarjeta «Compra todo en» y enlace del plan', async ({ page }) => {
      test.skip(size.onlyPlan, 'La horizontal solo se revisa en /canasta/plan');
      // Sin el producto que nadie vende, una tienda tiene todo y sale «Compra todo en».
      await seed(page, 'valora:canasta', basketOf(PRODUCTS.slice(0, 3)));
      await fakeApi(page);
      await page.goto('/canasta');
      await expect(page.getByRole('link', { name: 'Armar plan de compra' })).toBeVisible();
      await check(page, 'canasta', size.name, ['Compra todo en'], 'aside');
    });

    test('/canasta/plan: por municipio, con 3 tiendas y domicilio', async ({ page }) => {
      await fakeApi(page);
      await page.goto('/canasta/plan');
      await expect(page.getByRole('heading', { name: '2 tiendas' })).toBeVisible();
      await page.getByText('Probar con 3 tiendas').click();
      await page.getByRole('switch', { name: 'Me lo llevan a casa' }).first().check();
      await page.getByLabel('¿Cuánto cobra el domicilio?').first().fill('1234567');
      await page.getByLabel('Cómo cuentas el traslado').selectOption('fare');
      await page.getByLabel('Pasaje por tramo (COP)').fill('1500');
      await expect(page.getByRole('button', { name: 'Guardar plan' }).first()).toBeVisible();
      await check(page, 'plan-municipio', size.name, ['Plan de compra', 'Supuestos del traslado']);
    });

    test('/canasta/plan: con ubicación, radio y plan guardado', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 4.5339, longitude: -75.6811 });
      await seed(page, 'valora:donde', 'ubicacion');
      await seed(page, 'valora:planes', { v: 1, plans: [savedPlan('plan-uno', 2)] });
      await fakeApi(page);
      await page.goto('/canasta/plan');
      await expect(page.getByRole('heading', { name: '2 tiendas' })).toBeVisible();
      await page.getByRole('button', { name: 'Guardar plan' }).first().click();
      await expect(page.getByText('Plan guardado', { exact: true })).toBeVisible();
      await check(page, 'plan-ubicacion', size.name, ['Radio', 'Mis planes guardados']);
    });

    test('/canasta/plan: sin precio vigente cerca y con error', async ({ page }) => {
      await fakeApi(page, 'empty');
      await page.goto('/canasta/plan');
      await expect(page.getByRole('heading', { name: 'Sin precio vigente cerca' })).toBeVisible();
      await check(page, 'plan-sin-precio', size.name, ['Volver a mi canasta']);
      await page.unrouteAll();
      await fakeApi(page, 'error');
      await page.reload();
      await expect(page.getByRole('alert')).toBeVisible();
      await check(page, 'plan-error', size.name, ['Plan de compra']);
    });

    test('/canasta/plan: con 5 planes guardados avisa que está lleno', async ({ page }) => {
      const plans = ['a', 'b', 'c', 'd', 'e'].map((id) => savedPlan(`plan-${id}`, 2));
      await seed(page, 'valora:planes', { v: 1, plans });
      await fakeApi(page);
      await page.goto('/canasta/plan');
      await page.getByRole('button', { name: 'Guardar plan' }).first().click();
      await expect(page.getByText(/Ya tienes 5 planes guardados/)).toBeVisible();
      await check(page, 'plan-lleno', size.name, ['Mis planes guardados']);
    });

    test('/canasta/plan/:id: plan guardado con 5 tiendas', async ({ page }) => {
      test.skip(size.onlyPlan, 'La horizontal solo se revisa en /canasta/plan');
      await seed(page, 'valora:planes', { v: 1, plans: [savedPlan('plan-cinco')] });
      await fakeApi(page);
      await page.goto('/canasta/plan/plan-cinco');
      await expect(page.getByRole('heading', { name: 'Plan de compra guardado' })).toBeVisible();
      await check(page, 'plan-guardado', size.name, [
        'Totales',
        'Compartir',
        'Descargar',
        'Imprimir',
        'Armar de nuevo con precios de hoy',
        'Borrar este plan',
      ]);
    });
  });
}

test.describe('modo oscuro', () => {
  test.use({ colorScheme: 'dark' });
  for (const size of [SIZES[0], SIZES[6]]) {
    if (!size) continue;
    test(`/canasta/plan a ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await seed(page, 'valora:canasta', basketOf(PRODUCTS));
      await fakeApi(page);
      await page.goto('/canasta/plan');
      await expect(page.getByRole('heading', { name: '2 tiendas' })).toBeVisible();
      await check(page, 'plan-oscuro', size.name, ['Supuestos del traslado']);
    });
  }
});
