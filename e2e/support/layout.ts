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

// Los siete tamaños de la regresión «sin scroll anidado» de Inicio, producto, mapa y tienda: tres de
// celular y tableta y los cuatro portátiles.
export const SEVEN_SIZES = [
  ...SIZES.filter(({ width }) => width === 360 || width === 390 || width === 768),
  ...LAPTOPS,
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
          'a[href], button, summary, input, label.rec-option, label:has(> input[type=checkbox])',
        )) {
          if (el.matches('input[type=radio]')) continue;
          // Una casilla dentro de su etiqueta se toca por la etiqueta entera (WCAG 2.5.8): se mide ella.
          if (el.matches('input[type=checkbox]') && el.closest('label')) continue;
          // La atribución de OpenStreetMap la pone Leaflet, es un enlace dentro de una frase.
          if (el.closest('.leaflet-container') && !el.closest('.leaflet-bar')) continue;
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

export interface TabStop {
  inAside: boolean;
  cy: number;
  top: number;
  // El borde de arriba queda tapado por la barra superior fija (WCAG 2.4.11).
  covered: boolean;
  // El mapa de Leaflet al que pertenece (sus pines, zoom y atribución van en el orden de Leaflet).
  map: number;
  // La caja en la página: un control dentro de la caja de la parada anterior no cuenta como un salto.
  box: { top: number; bottom: number; left: number; right: number };
  name: string;
}

// Recorre el contenido con Tab desde `start` (hasta salir de <main>) y anota dónde cae el foco: si está
// en el panel (`aside`), su centro vertical en la página, su borde superior en la ventana y su nombre.
export async function tabStops(page: Page, start: Locator, max = 120) {
  await start.focus();
  const stops: TabStop[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el?.closest('main')) return null;
      // La casilla de radio va escondida: lo que se ve es su ficha.
      const t = (
        el.matches('input[type=radio]') ? (el.closest('label') ?? el) : el
      ).getBoundingClientRect();
      const bar = document.querySelector('header.top');
      const barBottom =
        bar && getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().bottom : 0;
      return {
        inAside: Boolean(el.closest('aside')),
        cy: t.y + window.scrollY + t.height / 2,
        top: t.y,
        covered: t.y < barBottom - 1,
        map: [...document.querySelectorAll('.leaflet-container')].findIndex((m) => m.contains(el)),
        box: {
          top: t.y + window.scrollY,
          bottom: t.bottom + window.scrollY,
          left: t.left,
          right: t.right,
        },
        name:
          (el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 50) ||
          `${el.tagName.toLowerCase()}.${String(el.getAttribute('class'))}`,
      };
    });
    if (!stop) break;
    stops.push(stop);
  }
  return stops;
}

// Los saltos hacia arriba de una secuencia de paradas: cada una debe estar a la altura de la anterior o
// más abajo. Una parada que comparte altura con la anterior (la misma fila, o la columna de al lado:
// la barra del radio y sus chips) no sube; `slack` es lo que puede quedar por encima. Dentro de un mismo
// mapa de Leaflet el orden es el de Leaflet (pines, zoom, atribución).
export function upwardJumps(stops: TabStop[], slack: number) {
  const problems: string[] = [];
  for (let i = 1; i < stops.length; i++) {
    const [a, b] = [stops[i - 1], stops[i]];
    if (!a || !b || (a.map >= 0 && a.map === b.map)) continue;
    if (b.box.bottom + slack < a.box.top) problems.push(`«${b.name}» sube respecto de «${a.name}»`);
  }
  return problems;
}

// Recorre el contenido con Tab desde `start` y dice si el foco va como se ve: primero todo lo de la
// columna principal, de arriba abajo, y al final lo del panel (`aside`: a la derecha en computador, abajo
// o fijo abajo en celular).
export async function focusOrderProblems(page: Page, start: Locator, slack: number) {
  const stops = await tabStops(page, start);
  const problems: string[] = [];
  const first = stops.findIndex((s) => s.inAside);
  if (first === -1) problems.push('el panel no recibe el foco');
  else if (stops.slice(first).some((s) => !s.inAside))
    problems.push('el contenido principal vuelve después del panel');
  return [...problems, ...upwardJumps(first === -1 ? stops : stops.slice(0, first), slack)];
}
