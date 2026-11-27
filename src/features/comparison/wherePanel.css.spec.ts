import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/features/comparison/comparison.css'), 'utf-8');

const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `falta ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
};

describe('«Listo» del ¿Dónde buscar?: estilos', () => {
  it('solo flota abajo en la hoja del celular; en el popover va al final y no tapa los chips', () => {
    expect(css).not.toMatch(/(^|\n)\.where-panel > \.btn \{/);
    expect(rule('.overlay-sheet .where-panel > .btn')).toMatch(/position:\s*sticky/);
  });

  it('en la hoja queda por encima del buscador, que también es sticky con z-index 1', () => {
    expect(rule('.overlay-sheet .where-panel > .btn')).toMatch(/z-index:\s*2/);
  });
});
