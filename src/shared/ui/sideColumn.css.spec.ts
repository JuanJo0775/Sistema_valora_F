import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/shared/ui/base.css'), 'utf-8');

// La columna lateral (.side) solo se queda fija si cabe entera en la ventana (SidePanel le pone `fit` tras
// medirla). Nunca tiene altura máxima ni scroll propio: un scroll dentro del scroll de la página (scroll
// anidado) deja partes cortadas y es difícil con teclado, lector de pantalla y dedo.
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (selector: string) =>
  new RegExp(String.raw`(?:^|\n)\s*${selector.replace('.', String.raw`\.`)}\s*\{([^}]*)\}`).exec(
    code,
  )?.[1] ?? '';

describe('columna lateral', () => {
  it('por defecto fluye con la página: sin posición fija, altura máxima ni overflow', () => {
    const side = rule('.side');
    expect(side).not.toMatch(/position|max-height|overflow/);
  });

  it('se queda fija solo desde 960 px y solo si cabe (.fit)', () => {
    const desktop =
      /@media \(width >= 960px\) \{[\s\S]*?\.side\.fit \{([^}]*)\}/.exec(code)?.[1] ?? '';
    expect(desktop).toMatch(/position:\s*sticky/);
    expect(desktop).toMatch(/top:\s*88px/);
    expect(desktop).not.toMatch(/max-height|overflow/);
    expect(code).not.toMatch(/\.side\s*\{[^}]*position:\s*sticky/);
  });

  it('no deja ningún scroll ni barra de desplazamiento propios', () => {
    expect(code).not.toMatch(/--side-h|scrollbar|overscroll/);
    expect(code.match(/\.side[^{]*\{[^}]*overflow/g)).toBeNull();
  });
});

// La lista de tiendas del mapa es una columna de la página: sin alto fijo ni overflow, y «Sugerir una
// tienda» es el primer elemento de la lista, no uno que se queda pegado debajo de la barra de arriba.
describe('lista de tiendas del mapa', () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8');
  const stores = read('src/features/stores/stores.css');
  const web = read('src/shared/ui/web.css');
  const page = read('src/features/stores/MapPage.tsx');

  it('no usa el nombre .store-list, que es de los reportes', () => {
    expect(page).not.toMatch(/store-list/);
    expect(page).toMatch(/className="map-side"/);
  });

  it('no tiene alto propio ni otra regla de overflow o de max-height', () => {
    expect(stores).not.toMatch(/\.map-side\s*\{[^}]*height/);
    expect(stores).not.toMatch(/overflow-y|max-heights*:|--side-h/);
    expect(web).not.toMatch(/scrollbar/);
  });

  it('el mapa tiene una sola regla de alto', () => {
    expect(stores).not.toMatch(/\.store-map\s*\{[^}]*height:\s*560px/);
    expect(web.match(/\.stores \.store-map/g)).toHaveLength(1);
  });

  it('«Sugerir una tienda» no se queda pegado (sticky) a la ventana', () => {
    expect(stores).not.toMatch(/\.suggest-store\s*\{[^}]*position:\s*sticky/);
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
