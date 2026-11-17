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
    expect(desktop).toMatch(/max-height:\s*calc\(100dvh\s*-\s*88px\s*-\s*16px\)/);
    expect(desktop).toMatch(/overflow-y:\s*auto/);
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
