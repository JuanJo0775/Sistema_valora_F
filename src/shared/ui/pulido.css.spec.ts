import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf-8');
const base = read('src/shared/ui/base.css');
const catalog = read('src/features/catalog/catalog.css');
const chipRow = read('src/shared/ui/chipRow.css');
const comparison = read('src/features/comparison/comparison.css');
const history = read('src/features/history/history.css');

// El texto de un bloque @media (hasta su llave de cierre en la columna 0).
function block(css: string, header: string): string {
  const start = css.indexOf(header);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('\n}\n', start));
}

describe('objetivos táctiles de los enlaces dentro del texto', () => {
  it('los enlaces de formularios, avisos y textos legales suman 24 px de alto con relleno vertical', () => {
    const start = base.indexOf('.form p a,');
    expect(start).toBeGreaterThan(-1);
    const rule = base.slice(start, base.indexOf('}', start));
    for (const selector of ['.form p a', '.form label a', '.banner a', '.cookie-notice a']) {
      expect(rule).toContain(selector);
    }
    // 18 px de línea de texto más 2 × 5 px de relleno: más de 24 px, sin mover las líneas.
    expect(rule).toMatch(/padding-block:\s*5px/);
  });
});

describe('tableta vertical: el detalle del producto', () => {
  it('se centra con un ancho de lectura entre 600 y 959 px', () => {
    const rules = block(catalog, '@media (600px <= width < 960px)');
    expect(rules).toMatch(/\.with-side\.product\s*\{[^}]*max-width:\s*720px/);
    expect(rules).toMatch(/margin-inline:\s*auto/);
    expect(rules).toMatch(/max-width:\s*480px/);
  });

  it('desde 768 px el panel de compra va en dos columnas', () => {
    const rules = block(catalog, '@media (768px <= width < 960px)');
    expect(rules).toMatch(/grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(rules).toMatch(/\.history-summary\s*\{[^}]*grid-column:\s*1 \/ -1/);
  });
});

describe('categorías del Inicio en varias líneas', () => {
  it('pasan a varias líneas, sin overflow ni scroll horizontal', () => {
    const rule = /\.category-chips\.chip-row\s*\{([^}]*)\}/.exec(chipRow)?.[1] ?? '';
    expect(rule).toMatch(/flex-wrap:\s*wrap/);
    expect(rule).toMatch(/overflow:\s*visible/);
    expect(chipRow).not.toMatch(/nowrap|overflow-x:\s*auto|mask-image|scroll-behavior/);
  });

  it('ya no hay flechas de desplazamiento', () => {
    expect(chipRow).not.toMatch(/chip-arrow/);
    expect(read('src/shared/ui/highlight.css')).not.toMatch(/chip-arrow/);
    expect(comparison).not.toMatch(
      /pointer:\s*fine\)\s*\{\s*\.category-chips\s*\{\s*flex-wrap:\s*wrap/,
    );
  });
});

describe('gráfico del historial', () => {
  it('tiene un alto máximo para que no crezca sin límite en tableta y escritorio', () => {
    expect(history).toMatch(/\.history-chart\s*\{[^}]*max-height:\s*220px/);
  });
});

describe('tableta vertical: pantallas de una columna', () => {
  it('Yo, Ajustes, la canasta, el plan, los aportes y el historial se centran con ancho de lectura', () => {
    const rules = block(base, '@media (600px <= width < 960px)');
    for (const selector of [
      '.profile',
      '.plan',
      '.contributions',
      '.history',
      '.with-side:has(> .basket)',
    ]) {
      expect(rules).toContain(selector);
    }
    expect(rules).toMatch(/max-width:\s*720px/);
    expect(rules).toMatch(/margin-inline:\s*auto/);
  });
});

describe('aviso de verificar el correo', () => {
  it('trae sus propios estilos: aparece en todas las pantallas, no solo en las de cuenta', () => {
    expect(read('src/features/auth/VerifyEmailBanner.tsx')).toMatch(/import '\.\/auth\.css'/);
  });
});
