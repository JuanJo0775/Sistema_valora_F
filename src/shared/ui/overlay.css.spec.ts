import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf-8');
const css = read('src/shared/ui/overlay.css');
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `falta ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
};

describe('popover y hoja del «¿Dónde?»: estilos', () => {
  it('usa solo tokens del tema, sin colores fijos', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/i);
  });

  it('queda por encima de la barra inferior, la barra de compra, las cookies y la instalación', () => {
    const z = Number(/z-index:\s*(\d+)/.exec(rule('.overlay'))?.[1]);
    const others = [
      'src/app/layout.css',
      'src/features/basket/basket.css',
      'src/features/legal/legal.css',
      'src/pwa/install.css',
    ]
      .flatMap((path) => [...read(path).matchAll(/z-index:\s*(\d+)/g)])
      .map((match) => Number(match[1]));
    expect(z).toBeGreaterThan(Math.max(...others));
  });

  it('la hoja se pega abajo con la zona segura y se desplaza dentro, sin desborde horizontal', () => {
    const sheet = rule('.overlay-sheet .overlay-panel');
    expect(sheet).toMatch(/inset:\s*auto 0 0/);
    expect(sheet).toMatch(/safe-area-inset-bottom/);
    expect(sheet).toMatch(/max-height/);
    expect(rule('.overlay-body')).toMatch(/overflow-y:\s*auto/);
  });

  it('opciones y botones se tocan en 44 px o más', () => {
    for (const selector of ['.option', '.option-search', '.select-trigger', '.overlay-close']) {
      expect(rule(selector)).toMatch(/var\(--touch\)/);
    }
    expect(read('src/features/comparison/comparison.css')).toMatch(
      /\.where-trigger\s*\{[^}]*min-height:\s*var\(--touch\)/,
    );
  });

  it('el foco se ve y la animación de la hoja se apaga con movimiento reducido (base.css)', () => {
    expect(css).toMatch(/\.option-items:focus-visible[^{]*\{[^}]*outline/);
    expect(read('src/shared/ui/base.css')).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });
});
