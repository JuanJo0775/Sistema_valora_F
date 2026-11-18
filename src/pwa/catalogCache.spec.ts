import { describe, expect, it } from 'vitest';
import { CATALOG_PRODUCT, FEATURED_WITHOUT_LOCATION } from './catalogCache';

const id = '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d';

describe('caché del catálogo para registrar sin señal', () => {
  it('guarda el detalle de un producto (catálogo, no precios)', () => {
    expect(CATALOG_PRODUCT.test(`https://valora.app/v1/products/${id}`)).toBe(true);
  });

  it.each([
    [`/v1/products/${id}/comparison?municipality=armenia`, 'la comparación'],
    [`/v1/products/${id}/history`, 'el historial'],
    ['/v1/products?q=arroz', 'la búsqueda'],
    ['/v1/establishments/nearby?lat=4.5&lng=-75.6', 'las tiendas cercanas'],
  ])('no guarda %s (%s): los precios y la ubicación siempre van a la red', (path) => {
    expect(CATALOG_PRODUCT.test(`https://valora.app${path}`)).toBe(false);
  });
});

describe('caché de la canasta básica (stale-while-revalidate)', () => {
  it('guarda la canasta de un municipio, sin ubicación', () => {
    expect(
      FEATURED_WITHOUT_LOCATION.test(
        'https://valora.app/v1/featured-products?municipality=armenia',
      ),
    ).toBe(true);
  });

  it.each([
    '/v1/featured-products?lat=4.5&lng=-75.6&radiusKm=2',
    '/v1/featured-products?municipality=armenia&lng=-75.6',
    '/v1/featured-products?radiusKm=2&lat=4.5',
  ])('no guarda %s: con ubicación es no-store (EC-08)', (path) => {
    expect(FEATURED_WITHOUT_LOCATION.test(`https://valora.app${path}`)).toBe(false);
  });
});
