import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, stubApi } from '../../test/fakeApi';
import { StorePage } from './StorePage';

vi.mock('./StoreMap', () => ({
  StoreMap: ({ stores }: { stores: { name: string }[]; label: string }) => (
    <p>{`Mapa con: ${stores.map(({ name }) => name).join(', ')}`}</p>
  ),
}));

const ARA = '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d';
const ara = {
  id: ARA,
  name: 'Ara',
  type: 'descuento',
  address: 'Calle 21 # 15-30',
  lat: 4.5339,
  lng: -75.6811,
  municipality: 'armenia',
};
const price = (productName: string, priceCop: number, extra: Record<string, unknown> = {}) => ({
  productId: crypto.randomUUID(),
  presentationId: crypto.randomUUID(),
  productName,
  reportId: crypto.randomUUID(),
  priceCop,
  unitPrice: { valueCop: priceCop / 10, per: '100g' },
  source: 'comunidad',
  freshness: 'vigente',
  reliability: 'alta',
  confirmations: 1,
  observedAt: new Date().toISOString(),
  ...extra,
});
const banana = price('Banano', 4500);

const storeReply = (prices: unknown[]): FakeReply => ({
  status: 200,
  body: { establishment: ara, prices },
});
const stubStore = (reply: FakeReply | FakeReply[]) =>
  stubApi({ [`GET /v1/establishments/${ARA}/prices`]: reply });

const renderStore = () =>
  render(
    <MemoryRouter initialEntries={[`/tiendas/${ARA}`]}>
      <Routes>
        <Route path="/tiendas/:establishmentId" element={<StorePage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('página de una tienda', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra la tienda, dónde queda y todos sus precios', async () => {
    stubStore(storeReply([banana]));

    renderStore();

    expect(await screen.findByRole('heading', { name: 'Ara' })).toBeInTheDocument();
    expect(screen.getByText('Descuento · Calle 21 # 15-30 · Armenia')).toBeInTheDocument();
    expect(screen.getByText('Mapa con: Ara')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cómo llegar a Ara' })).toBeInTheDocument();
    const row = within(screen.getByRole('link', { name: /Banano/ }).closest('li') as HTMLElement);
    expect(screen.getByRole('link', { name: /Banano/ })).toHaveAttribute(
      'href',
      `/productos/${banana.productId}`,
    );
    expect(row.getByText('$4.500')).toBeInTheDocument();
    expect(row.getByText('$450 por 100 g')).toBeInTheDocument();
    expect(row.getByText('Confiabilidad alta')).toBeInTheDocument();
  });
});
