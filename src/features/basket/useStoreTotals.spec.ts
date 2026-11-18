import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import type { BasketItem } from './basketContext';
import { type Area, useStoreTotals } from './useStoreTotals';

const item = (productId: string, presentationId: string, quantity = 1): BasketItem => ({
  productId,
  productName: productId,
  presentationId,
  presentationLabel: '1 und',
  quantity,
  bought: false,
});

const priceAt = (store: string, presentationId: string, priceCop: number) => ({
  establishment: {
    id: store,
    name: store,
    type: 'barrio',
    lat: 4.5339,
    lng: -75.6811,
    municipality: 'armenia',
  },
  reportId: `${store}-${presentationId}`,
  presentationId,
  priceCop,
  unitPrice: { valueCop: priceCop, per: 'und' },
  source: 'comunidad',
  freshness: 'vigente',
  reliability: 'alta',
  confirmations: 1,
  isCheapest: false,
  observedAt: '2026-11-16T15:00:00Z',
});

const comparison = (productId: string, ...results: unknown[]) => ({
  [`GET /v1/products/${productId}/comparison`]: {
    status: 200,
    body: { productId, criteria: { sort: 'unit_price' }, results },
  },
});

const stored = () =>
  JSON.stringify(
    Object.keys(localStorage)
      .sort()
      .map((key) => [key, localStorage.getItem(key)]),
  );

describe('useStoreTotals: dónde se busca (#plan-de-compra)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sin área consulta por municipio, como hoy', async () => {
    const { requested } = stubApi(comparison('arroz', priceAt('Ara', 'a1', 2600)));
    const { result } = renderHook(() => useStoreTotals([item('arroz', 'a1')]));

    await waitFor(() => {
      expect(result.current.totals.status).toBe('ready');
    });
    const query = requested[0]?.searchParams;
    expect(query?.get('municipality')).toBe('armenia');
    expect(query?.get('lat')).toBeNull();
    expect(query?.get('onlyCurrent')).toBe('true');
  });

  it('con ubicación y radio consulta por esa área y no por municipio', async () => {
    const { requested } = stubApi(comparison('arroz', priceAt('Ara', 'a1', 2600)));
    const area: Area = { lat: 4.53, lng: -75.68, radiusKm: 2 };
    const { result } = renderHook(() => useStoreTotals([item('arroz', 'a1')], area));

    await waitFor(() => {
      expect(result.current.totals.status).toBe('ready');
    });
    const query = requested[0]?.searchParams;
    expect(query?.get('lat')).toBe('4.53');
    expect(query?.get('lng')).toBe('-75.68');
    expect(query?.get('radiusKm')).toBe('2');
    expect(query?.get('municipality')).toBeNull();
  });

  it('cambiar el área vuelve a consultar', async () => {
    const { requested } = stubApi(comparison('arroz', priceAt('Ara', 'a1', 2600)));
    const { result, rerender } = renderHook(
      ({ area }: { area: Area }) => useStoreTotals([item('arroz', 'a1')], area),
      { initialProps: { area: { lat: 4.53, lng: -75.68, radiusKm: 1 } as Area } },
    );
    await waitFor(() => {
      expect(result.current.totals.status).toBe('ready');
    });

    rerender({ area: { lat: 4.53, lng: -75.68, radiusKm: 3 } });

    await waitFor(() => {
      expect(requested.map((url) => url.searchParams.get('radiusKm'))).toEqual(['1', '3']);
    });
  });

  it('el estado listo trae las líneas con las ofertas de cada producto', async () => {
    stubApi({
      ...comparison('arroz', priceAt('Ara', 'a1', 2600)),
      ...comparison('leche', priceAt('Ara', 'l1', 4000), priceAt('Éxito', 'l1', 3900)),
    });
    const { result } = renderHook(() =>
      useStoreTotals([item('arroz', 'a1', 2), item('leche', 'l1')]),
    );

    await waitFor(() => {
      expect(result.current.totals.status).toBe('ready');
    });
    const { totals } = result.current;
    if (totals.status !== 'ready') throw new Error('se esperaba el estado listo');
    expect(totals.lines.map(({ presentationId, quantity }) => [presentationId, quantity])).toEqual([
      ['a1', 2],
      ['l1', 1],
    ]);
    expect(totals.lines[1]?.offers).toHaveLength(2);
  });

  it('no guarda nada en el navegador (la ubicación nunca se guarda, EC-08)', async () => {
    stubApi(comparison('arroz', priceAt('Ara', 'a1', 2600)));
    const before = stored();
    const { result } = renderHook(() =>
      useStoreTotals([item('arroz', 'a1')], { lat: 4.53, lng: -75.68, radiusKm: 1.5 }),
    );

    await waitFor(() => {
      expect(result.current.totals.status).toBe('ready');
    });
    expect(stored()).toBe(before);
  });
});
