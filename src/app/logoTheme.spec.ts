import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Las pruebas corren desde la raíz del repositorio.
const css = readFileSync(join(process.cwd(), 'src/app/layout.css'), 'utf-8');

// El logo sigue al tema real (el atributo data-theme de <html>) y, sin elección manual, a la
// preferencia del sistema, igual que tokens.css. <picture> con prefers-color-scheme ignoraba la
// elección manual.
describe('logo del encabezado según el tema', () => {
  it('muestra la variante oscura con data-theme dark', () => {
    expect(css).toMatch(/:root\[data-theme='dark'\] \.logo-light\s*\{\s*display: none/);
    expect(css).toMatch(/:root\[data-theme='dark'\] \.logo-dark\s*\{\s*display: block/);
  });

  it('muestra la variante clara con data-theme light', () => {
    expect(css).toMatch(/:root\[data-theme='light'\] \.logo-dark\s*\{\s*display: none/);
  });

  it('sin elección manual, sigue la preferencia del sistema', () => {
    const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
    expect(media).toContain(":root:not([data-theme='light']) .logo-light");
    expect(media).toContain(":root:not([data-theme='light']) .logo-dark");
  });

  it('por defecto solo se ve el logo claro, con altura fija y ancho automático', () => {
    expect(css).toMatch(/\.logo-dark\s*\{\s*display: none/);
    expect(css).toMatch(/\.logo-img\s*\{[^}]*height: 30px[^}]*width: auto/);
    expect(css).toMatch(/\.logo-img\s*\{[^}]*height: 34px/);
  });
});
