import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf-8');
const layout = read('src/app/layout.css');
const comparison = read('src/features/comparison/comparison.css');
const stores = read('src/features/stores/stores.css');

describe('celular: reglas de CSS', () => {
  it('lo enfocado no queda bajo la barra de navegación ni bajo la barra de compra', () => {
    expect(layout).toMatch(
      /html\s*\{[^}]*scroll-padding-bottom:[^;]*var\(--tabbar-h\)[^;]*var\(--action-bar-h\)/,
    );
  });

  it('los enlaces sueltos de listas se tocan en 44 px', () => {
    expect(layout).toMatch(/\.offer h2 a[^{]*\{[^}]*min-height:\s*var\(--touch\)/);
    expect(layout).toMatch(/\.legal-index a[^{]*\{[^}]*min-height:\s*var\(--touch\)/);
  });

  it('en el celular cada tienda de la comparación usa el ancho completo bajo el nombre', () => {
    const start = comparison.indexOf('@media (width < 600px)');
    expect(start).toBeGreaterThan(-1);
    const block = comparison.slice(start, comparison.indexOf('\n}\n\n.offer-price', start));
    expect(block).toMatch(/\.offer-store\s*\{\s*display:\s*contents/);
    expect(block).toMatch(/grid-column:\s*2 \/ -1/);
  });

  it('los controles de zoom del mapa miden 44 px con el dedo', () => {
    expect(stores).toMatch(/@media \(pointer: coarse\)[\s\S]*leaflet-bar a[\s\S]*--touch/);
  });
});
