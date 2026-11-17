import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { BasketProvider } from './BasketProvider';
import { BasketSummary } from './BasketSummary';

const line = (productId: string, presentationId: string, quantity = 1) => ({
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
  reportId: crypto.randomUUID(),
  presentationId,
  priceCop,
  unitPrice: { valueCop: priceCop, per: 'und' },
  source: 'comunidad',
  freshness: 'vigente',
  reliability: 'alta',
  confirmations: 1,
  isCheapest: false,
  observedAt: new Date().toISOString(),
});

const prices = (productId: string, ...results: unknown[]) => ({
  [`GET /v1/products/${productId}/comparison`]: {
    status: 200,
    body: { productId, criteria: { sort: 'unit_price', municipality: 'armenia' }, results },
  },
});

const renderSummary = (...lines: ReturnType<typeof line>[]) => {
  localStorage.setItem('valora:canasta', JSON.stringify(lines));
  render(
    <BasketProvider>
      <MemoryRouter>
        <BasketSummary />
      </MemoryRouter>
    </BasketProvider>,
  );
};

describe('tu canasta, en el Inicio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('dice cuántos productos, el total en la tienda más barata y cuánto ahorras', async () => {
    stubApi({
      ...prices('arroz', priceAt('Ara', 'a1', 2600), priceAt('Éxito', 'a1', 2400)),
      ...prices('leche', priceAt('Ara', 'l1', 4000), priceAt('Éxito', 'l1', 3900)),
    });
    renderSummary(line('arroz', 'a1'), line('leche', 'l1'));

    const card = screen.getByRole('region', { name: 'Tu canasta · 2 productos' });
    expect(await within(card).findByText('$6.300')).toBeInTheDocument();
    expect(card).toHaveTextContent('Comprando en Éxito');
    expect(card).toHaveTextContent('Ahorras $300');
    expect(within(card).getByRole('link', { name: 'Ver mi canasta' })).toHaveAttribute(
      'href',
      '/canasta',
    );
  });

  it('con la canasta vacía no se muestra', () => {
    stubApi({});
    renderSummary();

    expect(screen.queryByRole('region', { name: /Tu canasta/ })).not.toBeInTheDocument();
  });

  it('si ninguna tienda tiene todo, igual lleva a la canasta', async () => {
    stubApi({
      ...prices('arroz', priceAt('Ara', 'a1', 2600)),
      ...prices('leche', priceAt('Éxito', 'l1', 3900)),
    });
    renderSummary(line('arroz', 'a1'), line('leche', 'l1'));

    const card = screen.getByRole('region', { name: 'Tu canasta · 2 productos' });
    expect(await within(card).findByText('Ninguna tienda tiene todo.')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Ver mi canasta' })).toBeInTheDocument();
  });
});
