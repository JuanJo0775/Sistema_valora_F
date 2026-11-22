import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf-8');

function cssFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(join(root, path)).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

// Los selectores con :hover y el encabezado del @media que los envuelve (vacío si están sueltos).
function hoverRules(css: string): { selector: string; media: string }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found: { selector: string; media: string }[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '{') {
      const header = text.slice(start, i).trim();
      if (header.startsWith('@')) stack.push(header);
      else {
        stack.push('');
        if (header.includes(':hover')) {
          found.push({ selector: header, media: stack.filter(Boolean).join(' ') });
        }
      }
      start = i + 1;
    } else if (char === '}') {
      stack.pop();
      start = i + 1;
    } else if (char === ';') start = i + 1;
  }
  return found;
}

describe('sistema de resaltes', () => {
  it('ningún :hover queda fuera de @media (hover: hover) and (pointer: fine)', () => {
    const loose: string[] = [];
    for (const file of cssFiles('src')) {
      for (const { selector, media } of hoverRules(read(file))) {
        // El relleno automático del navegador pide :hover para no pintarse de azul: no es un resalte.
        if (selector.includes(':-webkit-autofill')) continue;
        if (!/\(hover: hover\)/.test(media) || !/\(pointer: fine\)/.test(media)) {
          loose.push(`${file}: ${selector.replace(/\s+/g, ' ')}`);
        }
      }
    }
    expect(loose).toEqual([]);
  });

  it('el resalte nativo del navegador móvil está apagado', () => {
    expect(read('src/shared/ui/highlight.css')).toMatch(
      /html\s*\{\s*-webkit-tap-highlight-color:\s*transparent/,
    );
  });

  it('los tokens existen en claro, en oscuro y en oscuro forzado', () => {
    const tokens = read('src/shared/ui/tokens.css');
    const light = tokens.slice(0, tokens.indexOf('@media (prefers-color-scheme: dark)'));
    const dark = tokens.slice(tokens.indexOf('@media (prefers-color-scheme: dark)'));
    const forced = tokens.slice(tokens.indexOf(":root[data-theme='dark']"));
    for (const name of ['--hover-bg', '--press-bg', '--hover-ring', '--shadow-1', '--shadow-2']) {
      expect(light).toContain(`${name}:`);
      expect(dark).toContain(`${name}:`);
      expect(forced).toContain(`${name}:`);
    }
    // En claro nunca negro puro en las sombras.
    expect(light).not.toMatch(/--shadow-[12]:[^;]*rgb\(0 0 0/);
  });

  it('las filas se resaltan con pseudo-elemento redondeado y las tarjetas con --shadow-2', () => {
    const css = read('src/shared/ui/highlight.css');
    expect(css).toMatch(/\.offer-row::before[^{]*\{[^}]*border-radius:\s*var\(--r-s\)/);
    expect(css).toMatch(/\.product-card:hover[^{]*\{[^}]*box-shadow:\s*var\(--shadow-2\)/);
    expect(css).toMatch(/prefers-reduced-motion: no-preference\)[^{]*\{[^}]*translateY\(-1px\)/);
  });
});

describe('globo del mapa', () => {
  const css = read('src/features/stores/stores.css');
  it('usa los tokens del tema y sus dos botones miden lo mismo (44 px o más)', () => {
    expect(css).toMatch(/\.leaflet-popup-content-wrapper\s*\{[^}]*background:\s*var\(--bg\)/);
    expect(css).toMatch(/\.leaflet-popup-tip\s*\{[^}]*background:\s*var\(--bg\)/);
    expect(css).toMatch(/\.leaflet-popup \.pin-link\s*\{[^}]*min-height:\s*var\(--touch\)/);
    expect(css).toMatch(/a\.leaflet-popup-close-button\s*\{[^}]*width:\s*var\(--touch\)/);
  });
});
