import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applySiteUrl } from './site';

// Vista previa al compartir el enlace por WhatsApp y redes (Open Graph): si falta una etiqueta, la
// vista previa sale vacía o sin imagen. WhatsApp exige direcciones absolutas y una imagen pequeña.
// El build reemplaza __SITE_URL__ por la dirección real: se prueba ya reemplazada, como la ve el rastreador.
const SITE = 'https://valora.example';
const raw = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
const html = applySiteUrl(raw, SITE);
const canonical = (): string | undefined => /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1];
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
    expect(canonical()).toBe(`${SITE}/`);
    expect(meta('og:image')).toBe(`${SITE}/og-image.png`);
    expect(meta('twitter:image')).toBe(meta('og:image'));
  });

  it('la dirección del sitio sale de un solo lugar: sin direcciones fijas en index.html', () => {
    expect(raw).not.toMatch(/https?:\/\/(?!www\.sitemaps)/);
    expect(html).not.toContain('__SITE_URL__');
  });

  it('trae título, descripción y enlace canónico', () => {
    expect(/<title>([^<]+)<\/title>/.exec(html)?.[1]).toMatch(/^Valora: /);
    expect(meta('description')?.length).toBeGreaterThan(50);
    expect(meta('description')?.length).toBeLessThan(200);
    expect(meta('twitter:title')).toBe(meta('og:title'));
    expect(meta('twitter:image:alt')).toBe(meta('og:image:alt'));
    expect(meta('og:image:type')).toBe('image/png');
    expect(meta('twitter:description')).toBeTruthy();
  });

  it('trae lo que pide iOS para instalar la app', () => {
    expect(meta('apple-mobile-web-app-capable')).toBe('yes');
    expect(meta('mobile-web-app-capable')).toBe('yes');
    expect(meta('apple-mobile-web-app-title')).toBe('Valora');
    expect(meta('apple-mobile-web-app-status-bar-style')).toBe('default');
    expect(html).toMatch(
      /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon.png"/,
    );
    const icon = readFileSync(resolve(process.cwd(), 'public/apple-touch-icon.png'));
    expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([180, 180]);
  });

  it('la imagen mantiene la proporción 1,91:1 de las vistas previas', () => {
    expect(1200 / 630).toBeCloseTo(1.905, 2);
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
