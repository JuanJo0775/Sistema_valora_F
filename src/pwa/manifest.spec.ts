import { existsSync } from 'node:fs';
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

  it('los íconos del manifest existen en public/', () => {
    for (const icon of MANIFEST.icons) {
      expect(existsSync(join(process.cwd(), 'public', icon.src))).toBe(true);
    }
  });
});
