import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// La casilla «Comprado» (.check) mide 44 px de alto y por defecto alinea su contenido arriba: dentro de la
// fila de la canasta se veía descentrada respecto a la foto y al nombre.
const css = readFileSync(resolve(process.cwd(), 'src/features/basket/basket.css'), 'utf-8');

describe('fila de la canasta', () => {
  it('centra la casilla con el resto de la fila', () => {
    const rule = /\.basket-row \.check \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/align-items:\s*center/);
  });

  it('el nombre enlazado conserva el color y tiene foco visible', () => {
    expect(/\.basket-name \{[^}]*color:\s*inherit/.test(css)).toBe(true);
    expect(css).toMatch(/\.basket-name:focus-visible/);
  });

  it('en el celular angosto el contador y la papelera pasan a una segunda línea, debajo del nombre', () => {
    const start = css.indexOf('@media (width < 420px)');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('\n}\n', start));
    expect(block).toMatch(/\.basket-row \.stepper\s*\{[^}]*grid-column:\s*3/);
    expect(block).toMatch(/\.basket-row \.trash\s*\{[^}]*grid-column:\s*4/);
    // El nombre puede encogerse: sin esto quedaba en 20 px a 360 px de ancho.
    expect(css).toMatch(/grid-template-columns:\s*auto auto minmax\(0, 1fr\) auto auto/);
  });
});
