import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/features/commerce/merchant-prices.css'), 'utf-8');

const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `falta ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
};

describe('buscador del editor de precios: estilos', () => {
  it('el botón «Buscar en el catálogo» va al lado del campo y baja solo si no cabe', () => {
    const block = rule('.merchant-price-search');
    expect(block).toMatch(/display:\s*flex/);
    expect(block).toMatch(/flex-wrap:\s*wrap/);
    expect(block).toMatch(/align-items:\s*flex-end/);
  });
});
