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
