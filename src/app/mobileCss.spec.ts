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

// H-11 y hallazgo con sesión: el aviso de cookies no puede tapar el botón de enviar de los
// formularios. Se reserva su altura en el relleno de la página mientras exista.
describe('aviso de cookies y formularios', () => {
  it('el relleno inferior de la página suma la altura del aviso en celular y escritorio', () => {
    const page = layout.match(/\.page\s*\{[^}]*padding:[^;]*;/g) ?? [];
    expect(page.join('\n')).toMatch(/var\(--cookie-h\)/);
    expect(layout).toMatch(/\.page\s*\{\s*padding-bottom:\s*calc\(32px \+ var\(--cookie-h\)\)/);
  });

  it('con el aviso, el relleno cubre la franja: más que el aviso mismo', () => {
    const cookieH = Number(
      /:root:has\(\.cookie-notice\)\s*\{\s*--cookie-h:\s*(\d+)px/.exec(layout)?.[1],
    );
    const legal = read('src/features/legal/legal.css');
    // Alto del aviso: una línea de 0.8rem (≈ 17 px) o dos, más 12 px de relleno y 2 px de borde.
    expect(cookieH).toBeGreaterThanOrEqual(56);
    expect(legal).toMatch(/\.cookie-notice[^{]*\{[^}]*padding:\s*6px/);
  });

  it('el botón de enviar de «Crear cuenta» y «Entrar» es un botón normal dentro de .page', () => {
    for (const file of ['SignUp', 'SignIn']) {
      expect(read(`src/features/auth/${file}.tsx`)).toMatch(/type="submit"/);
    }
  });
});

// El botón principal de la barra, activo, no pierde su relleno (contraste en tema oscuro).
describe('botón «Registrar precio» activo', () => {
  it('conserva el relleno naranja y su texto cuando es la ruta actual', () => {
    expect(layout).toMatch(
      /\.tab\.primary\[aria-current='page'\]\s*\{[^}]*background:\s*var\(--accent\)[^}]*color:\s*var\(--on-accent\)/,
    );
  });
});
