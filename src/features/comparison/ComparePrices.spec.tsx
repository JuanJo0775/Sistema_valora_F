import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, stubApi } from '../../test/fakeApi';
import { ComparePrices } from './ComparePrices';

const rice = {
  id: '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d',
  name: 'Arroz blanco',
  brand: 'Diana',
  category: { code: 'grains-groceries', name: 'Granos y abarrotes' },
  presentations: [
    { id: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b', quantity: 500, unit: 'g', packCount: 1 },
    { id: '0b3f8d21-2c3e-4f40-9b0c-1d2e3f4a5b6c', quantity: 1, unit: 'kg', packCount: 1 },
  ],
};

const store = (id: string, name: string) => ({
  id,
  name,
  type: 'barrio',
  lat: 4.5339,
  lng: -75.6811,
  municipality: 'armenia',
});

const result = (overrides: Record<string, unknown> = {}) => ({
  establishment: store('5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d', 'Tienda Don Pepe'),
  reportId: '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918',
  presentationId: rice.presentations[0]?.id,
  priceCop: 2000,
  unitPrice: { valueCop: 400, per: '100g' },
  source: 'comunidad',
  freshness: 'vigente',
  reliability: 'alta',
  confirmations: 2,
  isCheapest: false,
  observedAt: new Date().toISOString(),
  ...overrides,
});

const comparison = (results: unknown[], criteria: Record<string, unknown> = {}) => ({
  status: 200,
  body: {
    productId: rice.id,
    criteria: { sort: 'unit_price', municipality: 'armenia', ...criteria },
    results,
    promotions: [],
  },
});

const stubCompare = (reply: FakeReply | FakeReply[]) =>
  stubApi({
    [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
    [`GET /v1/products/${rice.id}/comparison`]: reply,
  });

const renderCompare = () =>
  render(
    <MemoryRouter initialEntries={[`/productos/${rice.id}/comparar`]}>
      <Routes>
        <Route path="/productos/:productId/comparar" element={<ComparePrices />} />
      </Routes>
    </MemoryRouter>,
  );

describe('comparar precios', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cada resultado dice la tienda, la presentación con su precio y el precio por unidad', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    const [row] = await screen.findAllByRole('listitem');
    const item = within(row as HTMLElement);
    expect(item.getByRole('heading', { name: 'Tienda Don Pepe' })).toBeInTheDocument();
    expect(row).toHaveTextContent('500 g · $2.000');
    expect(row).toHaveTextContent('$400 por 100 g');
  });
});
