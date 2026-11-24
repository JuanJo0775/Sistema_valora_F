import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/features/stores/stores.css'), 'utf-8');
const start = css.indexOf('@media (width < 640px)');
const block = start === -1 ? '' : css.slice(start, css.indexOf('\n}\n', start));

describe('fila de precio de la ficha de tienda en celular', () => {
  it('el nombre del producto va en una fila completa y el precio debajo, en otra', () => {
    expect(start, 'falta el bloque de menos de 640 px').toBeGreaterThan(-1);
    expect(block).toMatch(
      /\.store-offer\s*\{[^}]*grid-template-areas:\s*'body body'\s*'thumb price'/,
    );
    expect(block).toMatch(/\.store-offer-body\s*\{[^}]*grid-area:\s*body/);
    expect(block).toMatch(/\.store-offer-price\s*\{[^}]*grid-area:\s*price/);
  });

  it('desde 640 px la fila sigue siendo miniatura, nombre y precio en una línea', () => {
    expect(css).toMatch(
      /\.store-offer\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto/,
    );
  });
});
