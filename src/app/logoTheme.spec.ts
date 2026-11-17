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

// En el celular el logo va centrado en la barra superior; desde 960 px sigue a la izquierda con el
// buscador y las secciones.
describe('logo centrado en el celular', () => {
  const corte = css.indexOf('@media (width >= 960px)');
  const mobile = css.slice(0, corte);
  const desktop = css.slice(corte);

  it('la barra superior centra el logo por defecto (celular)', () => {
    expect(mobile).toMatch(/\.top\s*\{[^}]*justify-content: center/);
  });

  it('desde 960 px el logo vuelve a la izquierda', () => {
    expect(desktop).toMatch(/\.top\s*\{[^}]*justify-content: flex-start/);
    expect(desktop).toMatch(/\.logo-img\s*\{\s*height: 34px/);
  });

  it('el enlace a inicio conserva los 44 px táctiles y el logo no desborda', () => {
    expect(css).toMatch(/\.logo-link\s*\{[^}]*min-height: var\(--touch\)/);
    expect(css).toMatch(/\.logo-img\s*\{[^}]*max-width: 100%/);
  });
});
