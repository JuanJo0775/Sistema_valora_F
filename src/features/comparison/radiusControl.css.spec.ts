import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/features/comparison/radiusControl.css'), 'utf-8');

const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `falta ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
};

describe('barra del radio: estilos', () => {
  it('usa solo tokens del tema, sin colores fijos', () => {
    expect(css).toMatch(/var\(--accent\)/);
    expect(css).toMatch(/var\(--line-2\)/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/i);
  });

  it('la pista mide 6 px: naranja hasta el valor y --line-2 el resto, en webkit y moz', () => {
    for (const selector of [
      '.radius-slider::-webkit-slider-runnable-track',
      '.radius-slider::-moz-range-track',
    ]) {
      const block = rule(selector);
      expect(block).toMatch(/height:\s*6px/);
      expect(block).toMatch(/var\(--accent\)/);
      expect(block).toMatch(/var\(--line-2\)/);
    }
  });

  it('el pulgar mide 28 px en webkit y moz', () => {
    for (const selector of [
      '.radius-slider::-webkit-slider-thumb',
      '.radius-slider::-moz-range-thumb',
    ]) {
      const block = rule(selector);
      expect(block).toMatch(/width:\s*28px/);
      expect(block).toMatch(/height:\s*28px/);
    }
  });

  it('la zona táctil de la barra es de 44 px (--touch)', () => {
    expect(rule('.radius-slider')).toMatch(/height:\s*var\(--touch\)/);
  });

  it('tiene anillo de foco visible', () => {
    expect(css).toMatch(/\.radius-slider:focus-visible::-webkit-slider-thumb/);
    expect(css).toMatch(/\.radius-slider:focus-visible::-moz-range-thumb/);
  });

  it('no desborda: el control se encoge dentro de su contenedor', () => {
    expect(rule('.radius-control')).toMatch(/min-inline-size:\s*0/);
    expect(rule('.radius-slider')).toMatch(/width:\s*100%/);
  });

  it('los seis chips van de a tres por fila, sin renglón deslizable', () => {
    const block = rule('.radius-control .category-chips');
    expect(block).toMatch(/display:\s*grid/);
    expect(block).toMatch(/repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(block).toMatch(/overflow:\s*visible/);
  });
});
