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
});
