// Dirección pública del sitio: el único lugar que cambia con el dominio propio.
// Se puede sobreescribir sin tocar el código con la variable de entorno SITE_URL (en Vercel:
// Settings > Environment Variables). Ver docs/INSTALAR_Y_COMPARTIR.md.
export const DEFAULT_SITE_URL = 'https://www.valoora.app';

// Marca que usa index.html donde va la dirección del sitio; el build la reemplaza.
export const SITE_URL_TOKEN = '__SITE_URL__';

/** Quita espacios y barras finales: «https://valora.co/» pasa a «https://valora.co». */
export function normalizeSiteUrl(value: string | undefined): string {
  const url = (value ?? '').trim().replace(/\/+$/, '');
  if (!url) return DEFAULT_SITE_URL;
  if (!/^https:\/\/[^\s/]+$/.test(url)) {
    throw new Error(
      `SITE_URL debe ser una dirección https sin ruta, por ejemplo ${DEFAULT_SITE_URL}`,
    );
  }
  return url;
}

export const applySiteUrl = (html: string, siteUrl: string): string =>
  html.split(SITE_URL_TOKEN).join(siteUrl);

// Rutas públicas que valen la pena para los buscadores. Lo demás (cuenta, registrar, moderación)
// es privado o depende de la persona.
export const SITEMAP_PATHS = ['/', '/mapa', '/canasta', '/privacidad'];

export const robotsTxt = (siteUrl: string): string =>
  ['User-agent: *', 'Allow: /', 'Disallow: /v1/', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');

export const sitemapXml = (siteUrl: string): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SITEMAP_PATHS.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
