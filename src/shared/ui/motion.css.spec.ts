import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/shared/ui/base.css'), 'utf-8');

describe('movimiento reducido', () => {
  it('con prefers-reduced-motion se apagan transiciones, animaciones y el scroll suave', () => {
    const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/scroll-behavior:\s*auto/);
    expect(block).toMatch(/leaflet-zoom-anim/);
  });
});
