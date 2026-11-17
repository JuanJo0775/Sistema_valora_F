import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/shared/ui/skeleton.css'), 'utf-8');

describe('esqueletos: estilos', () => {
  it('con prefers-reduced-motion no hay animación, solo color plano', () => {
    const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('\n}\n', start));

    expect(block).toMatch(/animation:\s*none/);
    expect(block).toMatch(/background-image:\s*none/);
  });

  it('usa los tokens del tema, sin colores fijos', () => {
    expect(css).toMatch(/var\(--bg-2\)/);
    expect(css).toMatch(/var\(--bg-3\)/);
    expect(css).toMatch(/var\(--line\)/);
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});
