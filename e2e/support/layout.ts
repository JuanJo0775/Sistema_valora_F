import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, type Locator, type Page } from '@playwright/test';

// Comprobaciones de maquetación que repiten las pruebas de la canasta y de «Dónde comprar».

export const MIN_TARGET = 24;
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core'), 'utf8');

// Los tamaños de prueba: los de siempre y los portátiles de 14" y 16", que son la mayoría del mercado.
export const SIZES = [
  { name: 'celular-360', width: 360, height: 740 },
  { name: 'celular-390', width: 390, height: 844 },
  { name: 'tableta-768', width: 768, height: 1024 },
  { name: 'tableta-820', width: 820, height: 1180 },
  { name: 'pc-1280', width: 1280, height: 800 },
  { name: 'pc-1440', width: 1440, height: 900 },
];
export const LAPTOPS = [
  { name: 'portatil-1280x720', width: 1280, height: 720 },
  { name: 'portatil-1366x768', width: 1366, height: 768 },
  { name: 'portatil-1536x864', width: 1536, height: 864 },
  { name: 'portatil-1728x1117', width: 1728, height: 1117 },
];

export const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

// Todo contenedor con desplazamiento propio (overflow auto, scroll u overlay) que de verdad desplaza:
// su contenido es más ancho o más alto que su caja. Es el scroll anidado y el scroll horizontal
// escondido que no queremos. La página misma (html y body) no cuenta.
export const nestedScrollers = (page: Page) =>
  page.evaluate(() => {
    const found: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      const style = getComputedStyle(el);
      const scrolls = (value: string) =>
        value === 'auto' || value === 'scroll' || value === 'overlay';
      const x = scrolls(style.overflowX) && el.scrollWidth > el.clientWidth;
      const y = scrolls(style.overflowY) && el.scrollHeight > el.clientHeight;
      if (x || y) {
        const cls = el.getAttribute('class');
        const name = `${el.tagName.toLowerCase()}${cls ? `.${cls.trim().split(/\s+/).join('.')}` : ''}`;
        found.push(
          `${name} ${String(el.scrollWidth)}×${String(el.scrollHeight)} en ${String(el.clientWidth)}×${String(el.clientHeight)}`,
        );
      }
    }
    return found;
  });

// Lo que se puede tocar dentro de `selector` y mide menos de 24 px (WCAG 2.5.8). Las casillas de radio
// van escondidas dentro de su ficha: se mide la etiqueta.
export const smallTargets = (page: Page, selector: string) =>
  page.evaluate(
    ([root, min]) => {
      const small: string[] = [];
      for (const scope of document.querySelectorAll(root)) {
        for (const el of scope.querySelectorAll(
          'a[href], button, summary, input, label.rec-option',
        )) {
          if (el.matches('input[type=radio]')) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.width < min || r.height < min)
            small.push(
              `${el.tagName.toLowerCase()} «${el.textContent.trim().slice(0, 30)}» ${String(Math.round(r.width))}×${String(Math.round(r.height))}`,
            );
        }
      }
      return small;
    },
    [selector, MIN_TARGET] as const,
  );

// axe: nada grave ni crítico.
export async function expectNoSeriousAxe(page: Page) {
  await page.evaluate(axeSource);
  const bad = await page.evaluate(async () => {
    const { violations } = await (
      window as unknown as {
        axe: { run: (n: Element) => Promise<{ violations: { id: string; impact: string }[] }> };
      }
    ).axe.run(document.body);
    return violations
      .filter(({ impact }) => impact === 'serious' || impact === 'critical')
      .map(({ id }) => id);
  });
  expect(bad, 'fallas graves o críticas de axe').toEqual([]);
}

// Recorre el contenido con Tab desde `start` y dice si el foco va como se ve: primero todo lo de la
// columna principal, de arriba abajo, y al final lo del panel (`aside`: a la derecha en computador, abajo
// o fijo abajo en celular). `slack` es lo que puede subir un elemento respecto del anterior (los de una
// misma fila tienen centros distintos).
export async function focusOrderProblems(page: Page, start: Locator, slack: number) {
  await start.focus();
  const stops: { inAside: boolean; cy: number; name: string }[] = [];
  for (let i = 0; i < 120; i++) {
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
        name: (el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 50),
      };
    });
    if (!stop) break;
    stops.push(stop);
  }
  const problems: string[] = [];
  const first = stops.findIndex((s) => s.inAside);
  if (first === -1) problems.push('el panel no recibe el foco');
  else if (stops.slice(first).some((s) => !s.inAside))
    problems.push('el contenido principal vuelve después del panel');
  const main = first === -1 ? stops : stops.slice(0, first);
  for (let i = 1; i < main.length; i++) {
    const [a, b] = [main[i - 1], main[i]];
    if (a && b && b.cy + slack < a.cy) problems.push(`«${b.name}» sube respecto de «${a.name}»`);
  }
  return problems;
}
