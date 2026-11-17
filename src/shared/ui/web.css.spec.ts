import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/shared/ui/web.css'), 'utf-8');

// El texto de un bloque @media (hasta su llave de cierre en la columna 0).
function block(header: string): string {
  const start = css.indexOf(header);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('\n}\n', start));
}

describe('versión web: estilos', () => {
  it('el contenido y la barra superior comparten el ancho máximo, y a 1440 px crece', () => {
    expect(block(':root {')).toMatch(/--page-max:\s*1080px/);
    expect(block('@media (width >= 1440px)')).toMatch(/--page-max:\s*1240px/);
    const desktop = block('@media (width >= 960px) {');
    expect(desktop).toMatch(/\.page\s*\{\s*max-width:\s*var\(--page-max\)/);
    expect(desktop).toMatch(/\.top\s*\{\s*padding-inline:[^;]*var\(--page-max\)[^;]*\+ 16px/);
  });

  it('las tarjetas llenan tantas columnas como quepan, solo en escritorio', () => {
    expect(block('@media (width >= 960px) {')).toMatch(
      /\.product-cards\s*\{\s*grid-template-columns:\s*repeat\(auto-fill, minmax\(220px, 1fr\)\)/,
    );
  });

  it('el mapa de escritorio usa la altura de la ventana', () => {
    expect(block('@media (width >= 960px) {')).toMatch(
      /\.stores \.store-map\s*\{\s*height:\s*clamp\(480px, calc\(100dvh - 340px\), 820px\)/,
    );
  });

  it('los precios usan cifras tabulares', () => {
    const start = css.indexOf('.offer-price,');
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(rule).toMatch(/\.cheapest-price/);
    expect(rule).toMatch(/\.product-card-price/);
  });

  it('el enlace de saltar al contenido está oculto hasta recibir el foco', () => {
    expect(block('.skip-link {')).toMatch(/transform:\s*translateY\(-200%\)/);
    expect(block('.skip-link:focus-visible')).toMatch(/transform:\s*none/);
  });

  it('las filas densas y los hover no tocan el celular', () => {
    expect(block('@media (width >= 960px) and (pointer: fine)')).toMatch(/min-height:\s*32px/);
    const hover = block('@media (hover: hover)');
    for (const selector of ['.btn:hover', '.tab:not', '.category-chip:not', '.offer-row:hover']) {
      expect(hover).toContain(selector);
    }
  });
});
