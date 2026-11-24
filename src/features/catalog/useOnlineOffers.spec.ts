import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { useOnlineOffers } from './useOnlineOffers';

const productId = '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d';
const path = '/v1/products/' + productId + '/online-offers';
const offer = {
  presentationId: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b',
  source: 'olimpica',
  zone: 'armenia-centro',
  priceCop: 3456,
  observedAt: '2026-11-24T14:00:00Z',
  expiresAt: '2026-11-26T14:00:00Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it('lee la oferta sintética del producto para la zona de prueba', async () => {
  const { requested } = stubApi({ ['GET ' + path]: { status: 200, body: { items: [offer] } } });
  const { result } = renderHook(() => useOnlineOffers(productId));
  await waitFor(() => {
    expect(result.current).toEqual({ status: 'ready', items: [offer] });
  });
  expect(requested[0]?.searchParams.get('zone')).toBe('armenia-centro');
});

it('entrega una lista vacía cuando la API no publica ofertas vigentes', async () => {
  stubApi({ ['GET ' + path]: { status: 200, body: { items: [] } } });
  const { result } = renderHook(() => useOnlineOffers(productId));
  await waitFor(() => {
    expect(result.current).toEqual({ status: 'ready', items: [] });
  });
});

it('aísla el error de ofertas del resto de la ficha', async () => {
  stubApi({ ['GET ' + path]: { status: 503 } });
  const { result } = renderHook(() => useOnlineOffers(productId));
  await waitFor(() => {
    expect(result.current).toEqual({ status: 'unavailable' });
  });
});

it('deja de mostrar la oferta anterior cuando cambia el producto', async () => {
  const nextId = '8afdec69-8d0b-4557-898c-1807415478c1';
  stubApi({
    ['GET ' + path]: { status: 200, body: { items: [offer] } },
    ['GET /v1/products/' + nextId + '/online-offers']: { status: 200, body: { items: [] } },
  });
  const { result, rerender } = renderHook(({ id }) => useOnlineOffers(id), {
    initialProps: { id: productId },
  });
  await waitFor(() => {
    expect(result.current).toEqual({ status: 'ready', items: [offer] });
  });
  rerender({ id: nextId });
  expect(result.current).toEqual({ status: 'loading' });
  await waitFor(() => {
    expect(result.current).toEqual({ status: 'ready', items: [] });
  });
});
