import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Rewrite {
  source: string;
  destination: string;
  has?: { type: string; key: string; value: string }[];
}

// ADR-012: Vercel sirve la PWA y reenvía /v1/* a Render, para que el navegador vea un solo origen
// (la cookie SameSite=Lax y el CSRF siguen igual, sin CORS). El resto de rutas cae en index.html.
const { rewrites } = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf-8')) as {
  rewrites: Rewrite[];
};

// Vercel convierte la ruta de origen en una expresión regular que debe cubrir toda la ruta.
const matches = (source: string, path: string): boolean => {
  const pattern = source.replace(/:path\*/, '.*').replace(/:id/, '[^/]+');
  return new RegExp(`^${pattern}$`).test(path);
};
// Una regla con `has` solo aplica si la cabecera pedida coincide.
const applies = (rule: Rewrite, userAgent: string): boolean =>
  (rule.has ?? []).every(
    ({ key, value }) => key === 'user-agent' && new RegExp(value).test(userAgent),
  );
const firstRewrite = (path: string, userAgent = 'Mozilla/5.0 (Linux; Android 14)') =>
  rewrites.find((rule) => matches(rule.source, path) && applies(rule, userAgent));

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

  it('no deja caer ninguna ruta de la función de vista previa en index.html', () => {
    expect(firstRewrite('/api/og-producto')?.destination).not.toBe('/index.html');
  });

  it('los rastreadores de enlaces reciben la vista previa del producto; las personas, la app', () => {
    const id = '2dd98cfa-359f-56aa-8282-bc9f454fe079';
    for (const bot of [
      'WhatsApp/2.23.20.0 A',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Twitterbot/1.0',
      'TelegramBot (like TwitterBot)',
      'LinkedInBot/1.0 (compatible; Mozilla/5.0)',
    ]) {
      expect(firstRewrite(`/productos/${id}`, bot)?.destination).toBe('/api/og-producto?id=:id');
    }
    expect(firstRewrite(`/productos/${id}`)?.destination).toBe('/index.html');
    expect(firstRewrite(`/productos/${id}/historial`, 'WhatsApp/2.23')?.destination).toBe(
      '/index.html',
    );
  });

  // El enlace de restablecer trae un token de un solo uso: ni caché ni Referer.
  it('la pantalla de restablecer la contraseña no se guarda ni envía Referer', () => {
    const { headers } = JSON.parse(
      readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf-8'),
    ) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
    const rule = headers.find(({ source }) => source === '/restablecer-contrasena');
    expect(rule?.headers).toEqual(
      expect.arrayContaining([
        { key: 'Cache-Control', value: 'no-store' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ]),
    );
  });
});
