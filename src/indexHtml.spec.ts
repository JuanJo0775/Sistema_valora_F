import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vista previa al compartir el enlace por WhatsApp y redes (Open Graph): si falta una etiqueta, la
// vista previa sale vacía o sin imagen. WhatsApp exige direcciones absolutas y una imagen pequeña.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
const meta = (name: string): string | undefined =>
  new RegExp(`<meta\\s+(?:property|name)="${name}"\\s+content="([^"]*)"`, 's').exec(html)?.[1];

describe('index.html: vista previa al compartir el enlace', () => {
  it('trae título, descripción, tipo, sitio e idioma', () => {
    expect(meta('og:title')).toMatch(/Valora/);
    expect(meta('og:description')?.length).toBeGreaterThan(40);
    expect(meta('og:type')).toBe('website');
    expect(meta('og:site_name')).toBe('Valora');
    expect(meta('og:locale')).toBe('es_CO');
  });

  it('usa direcciones absolutas con https', () => {
    for (const name of ['og:url', 'og:image', 'twitter:image']) {
      expect(meta(name)).toMatch(/^https:\/\//);
    }
  });

  it('la imagen existe, mide 1200 x 630 y pesa menos de 300 KB', () => {
    const file = meta('og:image')?.split('/').pop() ?? '';
    const path = resolve(process.cwd(), 'public', file);
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeLessThan(300 * 1024);
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    // Cabecera PNG: el ancho y el alto van en los bytes 16 a 23 (IHDR).
    const header = readFileSync(path).subarray(16, 24);
    expect([header.readUInt32BE(0), header.readUInt32BE(4)]).toEqual([1200, 630]);
  });

  it('pide la tarjeta grande para Twitter y X', () => {
    expect(meta('twitter:card')).toBe('summary_large_image');
  });

  it('el color de la barra del navegador sigue el tema del sistema', () => {
    const colors = [
      ...html.matchAll(/<meta\s+name="theme-color"\s+content="([^"]*)"\s+media="([^"]*)"/g),
    ];
    expect(colors.map(([, color, media]) => [color?.toLowerCase(), media])).toEqual([
      ['#ffffff', '(prefers-color-scheme: light)'],
      ['#0d0d0e', '(prefers-color-scheme: dark)'],
    ]);
  });
});
