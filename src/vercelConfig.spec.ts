import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Rewrite {
  source: string;
  destination: string;
}

// ADR-012: Vercel sirve la PWA y reenvía /v1/* a Render, para que el navegador vea un solo origen
// (la cookie SameSite=Lax y el CSRF siguen igual, sin CORS). El resto de rutas cae en index.html.
const { rewrites } = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf-8')) as {
  rewrites: Rewrite[];
};

// Vercel convierte la ruta de origen en una expresión regular que debe cubrir toda la ruta.
const matches = (source: string, path: string): boolean => {
  const pattern = source.replace(/:path\*/, '.*');
  return new RegExp(`^${pattern}$`).test(path);
};
const firstRewrite = (path: string): Rewrite | undefined =>
  rewrites.find((rule) => matches(rule.source, path));

describe('vercel.json (ADR-012)', () => {
  it('reenvía /v1/* a la API en Render conservando la ruta', () => {
    const rule = firstRewrite('/v1/products');

    expect(rule?.destination).toMatch(/^https:\/\/[^/]+\/v1\/:path\*$/);
  });

  it('no deja caer ninguna ruta de la API en index.html', () => {
    expect(firstRewrite('/v1/auth/session')?.destination).not.toBe('/index.html');
    expect(firstRewrite('/v1/health')?.destination).not.toBe('/index.html');
  });

  it('las rutas de la app caen en index.html para que el router funcione al recargar', () => {
    expect(firstRewrite('/producto/abc')?.destination).toBe('/index.html');
    expect(firstRewrite('/moderacion')?.destination).toBe('/index.html');
  });
});
