import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// La columna fija de la derecha (.side) se queda quieta al desplazar la página, pero si es más alta que
// la pantalla debe tener su propio scroll: antes la parte de abajo quedaba cortada y sin forma de verla.
const css = readFileSync(resolve(process.cwd(), 'src/shared/ui/base.css'), 'utf-8');
const desktop = /@media \(width >= 960px\) \{[\s\S]*?\.side \{([^}]*)\}/.exec(css)?.[1] ?? '';

describe('columna lateral fija', () => {
  it('se queda fija solo desde 960 px', () => {
    expect(desktop).toMatch(/position:\s*sticky/);
  });

  it('nunca es más alta que la pantalla y se desplaza por dentro', () => {
    expect(css).toMatch(/--side-h:\s*calc\(100dvh\s*-\s*88px\s*-\s*16px\)/);
    expect(desktop).toMatch(/max-height:\s*var\(--side-h\)/);
    expect(desktop).toMatch(/overflow-y:\s*auto/);
  });

  it('tiene una sola barra, sin flechas de botones y sin mezclar los dos estilos', () => {
    expect(css).toMatch(/\.side::-webkit-scrollbar-button\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.side::-webkit-scrollbar\s*\{[^}]*width:\s*8px/);
    // scrollbar-width solo para quien no tiene la barra de WebKit; si no, Chrome pinta las flechas.
    expect(css).toMatch(
      /@supports not selector\(::-webkit-scrollbar\)[\s\S]*?scrollbar-width:\s*thin/,
    );
    const outside = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@supports not selector[\s\S]*?\n {2}\}\n/, '');
    expect(outside).not.toMatch(/scrollbar-width/);
  });
});

// La lista de tiendas del mapa: ya una vez la pisó otra regla ".store-list" (el selector de tienda de
// los reportes, 16 rem de alto máximo) y quedó cortada. Su alto y su desplazamiento son los de ".side".
describe('lista de tiendas del mapa', () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8');
  const stores = read('src/features/stores/stores.css');
  const web = read('src/shared/ui/web.css');
  const page = read('src/features/stores/MapPage.tsx');

  it('no usa el nombre .store-list, que es de los reportes', () => {
    expect(page).not.toMatch(/store-list/);
    expect(page).toMatch(/className="side map-side"/);
  });

  it('llena la columna con el mismo alto útil, sin otra regla de overflow ni de max-height', () => {
    expect(stores).toMatch(/\.map-side\s*\{\s*height:\s*var\(--side-h\)/);
    expect(stores).not.toMatch(/overflow-y|max-heights*:/);
    expect(web).not.toMatch(/scrollbar/);
  });

  it('el mapa tiene una sola regla de alto', () => {
    expect(stores).not.toMatch(/\.store-map\s*\{[^}]*height:\s*560px/);
    expect(web.match(/\.stores \.store-map/g)).toHaveLength(1);
  });

  it('«Sugerir una tienda» queda fijo arriba de la lista', () => {
    expect(stores).toMatch(/\.suggest-store\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/);
  });
});

// El gestor de contraseñas de Chrome pinta los campos autocompletados con sus colores (azul grisáceo y
// letra blanca): hay que devolverles los de la app, en el tema claro y en el oscuro.
describe('campos autocompletados', () => {
  const autofill = /\.field input:-webkit-autofill[\s\S]*?\{([^}]*)\}/.exec(css)?.[1] ?? '';

  it('conservan el color de letra y el fondo de la app', () => {
    expect(autofill).toMatch(/-webkit-text-fill-color:\s*var\(--ink\)/);
    expect(autofill).toMatch(/box-shadow:\s*0 0 0 1000px var\(--bg\) inset/);
  });

  it('cubren también el foco y el estándar :autofill', () => {
    expect(css).toMatch(/\.field input:-webkit-autofill:focus/);
    expect(css).toMatch(/\.field input:autofill/);
  });
});
