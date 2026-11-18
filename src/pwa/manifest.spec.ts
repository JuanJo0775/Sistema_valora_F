import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MANIFEST } from './manifest';

describe('manifest de la PWA', () => {
  it('tiene identificador estable, idioma y categorías', () => {
    expect(MANIFEST.id).toBe('/');
    expect(MANIFEST.lang).toBe('es-CO');
    expect(MANIFEST.categories).toEqual(expect.arrayContaining(['shopping', 'food']));
  });

  it('ofrece atajos a Registrar precio, Mapa y Canasta con íconos que existen', () => {
    const urls = Object.fromEntries(MANIFEST.shortcuts.map((s) => [s.name, s.url]));
    expect(urls).toEqual({
      'Registrar precio': '/registrar',
      Mapa: '/mapa',
      Canasta: '/canasta',
    });
    for (const shortcut of MANIFEST.shortcuts) {
      for (const icon of shortcut.icons) {
        expect(existsSync(join(process.cwd(), 'public', icon.src))).toBe(true);
      }
    }
  });

  it('usa el color del tema oscuro, el mismo de la barra del navegador y del fondo', () => {
    expect(MANIFEST.background_color).toBe('#0D0D0E');
    expect(MANIFEST.theme_color).toBe('#0D0D0E');
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('content="#0D0D0E" media="(prefers-color-scheme: dark)"');
    expect(html).toContain('content="#FFFFFF" media="(prefers-color-scheme: light)"');
    expect(readFileSync(join(process.cwd(), 'src/shared/ui/tokens.css'), 'utf8')).toMatch(
      /#0D0D0E/i,
    );
  });

  it('los íconos del manifest existen en public/', () => {
    for (const icon of MANIFEST.icons) {
      expect(existsSync(join(process.cwd(), 'public', icon.src))).toBe(true);
    }
  });
});
