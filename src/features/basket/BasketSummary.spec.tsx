import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { planDraft } from '../../test/planFixtures';
import { savePlan, toSavedPlan } from '../plan/savedPlan';
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

const saveLists = (count: number) => {
  for (let i = 0; i < count; i++)
    savePlan(toSavedPlan(planDraft(), new Date(`2026-11-0${String(i + 1)}T12:00:00Z`)));
};

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

  it('con listas guardadas, ofrece un enlace discreto a Guardadas con la cantidad', async () => {
    stubApi({ ...prices('arroz', priceAt('Ara', 'a1', 2600)) });
    saveLists(2);
    renderSummary(line('arroz', 'a1'));

    const card = screen.getByRole('region', { name: 'Tu canasta · 1 producto' });
    const link = within(card).getByRole('link', { name: 'Mis listas guardadas (2)' });
    expect(link).toHaveAttribute('href', '/canasta?tab=guardadas');
    expect(within(card).getByRole('link', { name: 'Ver mi canasta' })).toBeInTheDocument();
    await within(card).findByText('$2.600');
  });

  it('sin listas guardadas no aparece nada nuevo', async () => {
    stubApi({ ...prices('arroz', priceAt('Ara', 'a1', 2600)) });
    renderSummary(line('arroz', 'a1'));

    await screen.findByText('$2.600');
    expect(screen.queryByRole('link', { name: /Mis listas guardadas/ })).not.toBeInTheDocument();
  });

  it('con la canasta vacía y listas guardadas, invita a abrir una lista', () => {
    stubApi({});
    saveLists(1);
    renderSummary();

    const card = screen.getByRole('region', { name: 'Tu canasta' });
    expect(card).toHaveTextContent('Tu canasta está vacía');
    expect(within(card).getByRole('link', { name: 'Abre una lista guardada' })).toHaveAttribute(
      'href',
      '/canasta?tab=guardadas',
    );
    expect(within(card).queryByRole('link', { name: 'Ver mi canasta' })).not.toBeInTheDocument();
  });
});
