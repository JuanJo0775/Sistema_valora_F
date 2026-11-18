import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, escapeHtml, previewOf, renderPreviewHtml } from '../api/og-producto';
import {
  applySiteUrl,
  DEFAULT_SITE_URL,
  normalizeSiteUrl,
  robotsTxt,
  SITEMAP_PATHS,
  sitemapXml,
} from './site';

describe('dirección del sitio', () => {
  it('sin variable usa la dirección por defecto; con variable, la nueva sin barra final', () => {
    expect(normalizeSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(normalizeSiteUrl('')).toBe(DEFAULT_SITE_URL);
    expect(normalizeSiteUrl(' https://valora.co/ ')).toBe('https://valora.co');
  });

  it('rechaza lo que no es una dirección https sin ruta', () => {
    expect(() => normalizeSiteUrl('http://valora.co')).toThrow(/https/);
    expect(() => normalizeSiteUrl('https://valora.co/app')).toThrow(/https/);
  });

  it('reemplaza todas las marcas', () => {
    expect(applySiteUrl('a __SITE_URL__/x b __SITE_URL__/y', 'https://v.co')).toBe(
      'a https://v.co/x b https://v.co/y',
    );
  });

  it('robots.txt y sitemap.xml usan direcciones absolutas y no listan la API', () => {
    const site = 'https://valora.co';
    expect(robotsTxt(site)).toContain(`Sitemap: ${site}/sitemap.xml`);
    expect(robotsTxt(site)).toContain('Disallow: /v1/');
    const xml = sitemapXml(site);
    for (const path of SITEMAP_PATHS) expect(xml).toContain(`<loc>${site}${path}</loc>`);
    expect(xml).not.toMatch(/<loc>(?!https:\/\/)/);
  });
});

describe('vista previa de un producto para los rastreadores', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const product = {
    name: 'Arroz blanco',
    brand: 'Roa',
    presentations: [
      { quantity: 500, unit: 'g', packCount: 1 },
      { quantity: 1, unit: 'kg', packCount: 1 },
    ],
  };

  it('el título y la descripción llevan el producto, la marca y las presentaciones', () => {
    const { title, description } = previewOf(product);
    expect(title).toBe('Arroz blanco Roa: compara precios en Valora');
    expect(description).toContain('Arroz blanco Roa (500 g, 1 kg)');
  });

  it('sin producto cae en la vista previa general', () => {
    expect(previewOf(null).title).toBe('Valora: compara precios de tu barrio');
  });

  it('escapa el HTML del nombre', () => {
    expect(escapeHtml('<b>"a" & \'b\'</b>')).not.toMatch(/[<>"']/);
    const html = renderPreviewHtml('https://v.co', '/productos/x', { name: '<script>x</script>' });
    expect(html).not.toContain('<script>');
  });

  it('la página trae las etiquetas Open Graph y X con direcciones absolutas', () => {
    const html = renderPreviewHtml('https://v.co', '/productos/abc', product);
    for (const tag of [
      'og:title',
      'og:description',
      'og:url',
      'og:image',
      'twitter:card',
      'twitter:image',
    ]) {
      expect(html).toContain(tag);
    }
    expect(html).toContain('content="https://v.co/productos/abc"');
    expect(html).toContain('content="https://v.co/og-image.png"');
  });

  it('GET consulta la API del mismo sitio y devuelve el producto', async () => {
    const id = '2dd98cfa-359f-56aa-8282-bc9f454fe079';
    const fetchApi = vi.fn<(url: string) => Promise<Response>>(() =>
      Promise.resolve(Response.json(product)),
    );
    vi.stubGlobal('fetch', fetchApi);

    const response = await GET(new Request(`https://v.co/api/og-producto?id=${id}`));
    const html = await response.text();

    expect(fetchApi.mock.calls.map(([url]) => url)).toEqual([`https://v.co/v1/products/${id}`]);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Arroz blanco Roa');
    expect(html).toContain(`https://v.co/productos/${id}`);
  });

  it('si la API falla o el id no es válido, devuelve la vista previa general sin consultar', async () => {
    const fetchApi = vi.fn(() => Promise.reject(new Error('sin red')));
    vi.stubGlobal('fetch', fetchApi);

    const failed = await GET(
      new Request('https://v.co/api/og-producto?id=2dd98cfa-359f-56aa-8282-bc9f454fe079'),
    );
    expect(await failed.text()).toContain('Valora: compara precios de tu barrio');
    const before = fetchApi.mock.calls.length;
    const invalid = await GET(new Request('https://v.co/api/og-producto?id=../../x'));

    expect(invalid.status).toBe(200);
    expect(fetchApi.mock.calls.length).toBe(before);
  });
});
