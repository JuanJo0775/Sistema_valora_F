import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, stubApi, stubPendingApi } from '../../test/fakeApi';
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

  it('«Cómo llegar» queda arriba, antes del filtro y de la lista de precios', async () => {
    stubStore(storeReply([banana]));
    renderStore();

    const directions = await screen.findByRole('link', { name: 'Cómo llegar a Ara' });
    const filter = screen.getByRole('checkbox', { name: 'Solo precios vigentes' });
    expect(
      directions.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('«Solo precios vigentes» vuelve a pedir los precios sin los viejos', async () => {
    const api = stubStore(storeReply([banana]));
    renderStore();
    await screen.findByRole('heading', { name: 'Ara' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Solo precios vigentes' }));

    await vi.waitFor(() => {
      expect(api.requested.at(-1)?.searchParams.get('onlyCurrent')).toBe('true');
    });
  });

  it('sin precios lo dice', async () => {
    stubStore(storeReply([]));

    renderStore();

    expect(await screen.findByText('Todavía no hay precios en esta tienda.')).toBeInTheDocument();
  });

  it('si la tienda no existe lo dice y lleva al mapa', async () => {
    stubApi({});

    renderStore();

    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta tienda' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el mapa de tiendas' })).toHaveAttribute(
      'href',
      '/mapa',
    );
  });

  it('mientras carga dice «Cargando…»', () => {
    stubPendingApi();

    renderStore();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('si falla muestra el error y permite reintentar', async () => {
    stubStore([
      { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
      storeReply([banana]),
    ]);
    renderStore();

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Ara' })).toBeInTheDocument();
  });
});
