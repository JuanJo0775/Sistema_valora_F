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

  it('muestra la tienda en una tarjeta con su tipo, dirección, municipio y acciones', async () => {
    stubStore(storeReply([banana]));

    renderStore();

    const head = await screen.findByRole('banner');
    expect(within(head).getByRole('heading', { level: 1, name: 'Ara' })).toBeInTheDocument();
    const chip = within(head).getByText('Descuento');
    expect(chip).toHaveClass('type-descuento');
    expect(chip.querySelector('.pin-dot')).not.toBeNull();
    expect(within(head).getByText('Calle 21 # 15-30')).toBeInTheDocument();
    expect(within(head).getByText('Armenia')).toBeInTheDocument();
    expect(within(head).getByRole('link', { name: 'Cómo llegar a Ara' })).toBeInTheDocument();
    expect(within(head).getByRole('link', { name: 'Registrar un precio aquí' })).toHaveAttribute(
      'href',
      '/registrar',
    );
  });

  it('sin dirección dice «Sin dirección registrada»; con barrio lo suma al municipio', async () => {
    const reply = storeReply([banana]);
    (reply.body as { establishment: Record<string, unknown> }).establishment = {
      ...ara,
      address: undefined,
      neighborhood: 'Centro',
    };
    stubStore(reply);

    renderStore();

    expect(await screen.findByText('Sin dirección registrada')).toBeInTheDocument();
    expect(screen.getByText('Armenia · Centro')).toBeInTheDocument();
  });

  it('con precios: ubicación con su mapa, conteo y tarjetas de oferta', async () => {
    stubStore(storeReply([banana, price('Arroz', 3000)]));

    renderStore();

    await screen.findByRole('heading', { level: 1, name: 'Ara' });
    const place = screen.getByRole('complementary', { name: 'Ubicación' });
    expect(within(place).getByRole('heading', { level: 2, name: 'Ubicación' })).toBeVisible();
    expect(within(place).getByText('Mapa con: Ara')).toBeInTheDocument();
    const prices = screen.getByRole('region', { name: 'Precios' });
    expect(within(prices).getByText('2 productos con precio')).toBeInTheDocument();
    const row = within(screen.getByRole('link', { name: /Banano/ }).closest('li') as HTMLElement);
    expect(screen.getByRole('link', { name: /Banano/ })).toHaveAttribute(
      'href',
      `/productos/${banana.productId}`,
    );
    expect(row.getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(row.getByText('$4.500')).toBeInTheDocument();
    expect(row.getByText('$450 por 100 g')).toBeInTheDocument();
    expect(row.getByText('Confiabilidad alta')).toBeInTheDocument();
    expect(screen.queryByText(/Sé el primero/)).not.toBeInTheDocument();
  });

  it('con un solo precio el conteo va en singular', async () => {
    stubStore(storeReply([banana]));
    renderStore();

    expect(await screen.findByText('1 producto con precio')).toBeInTheDocument();
  });

  it('el encabezado va antes que el filtro y los precios', async () => {
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

  it('sin precios invita a registrar el primero y no muestra el filtro ni el conteo', async () => {
    stubStore(storeReply([]));

    renderStore();

    expect(await screen.findByRole('heading', { name: 'Aún no hay precios aquí' })).toBeVisible();
    expect(screen.getByText('Nadie ha reportado un precio en esta tienda todavía.')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Sé el primero en registrar un precio' }),
    ).toHaveAttribute('href', '/registrar');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/con precio/)).not.toBeInTheDocument();
    expect(screen.getByText('Mapa con: Ara')).toBeInTheDocument();
  });

  it('si el filtro deja la lista vacía, el filtro sigue para quitarlo', async () => {
    stubStore([storeReply([banana]), storeReply([])]);
    renderStore();
    await screen.findByRole('heading', { name: 'Ara' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Solo precios vigentes' }));

    expect(await screen.findByRole('heading', { name: 'No hay precios vigentes' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Solo precios vigentes' })).toBeChecked();
    expect(screen.queryByText(/Sé el primero/)).not.toBeInTheDocument();
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
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
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

  it('el pin de la tienda respeta la preferencia de forma', async () => {
    stubStore(storeReply([]));
    localStorage.setItem('valora:pines-forma', '1');
    renderStore();

    const chip = await screen.findByText('Descuento');
    expect(chip.querySelector('.pin-shape')).not.toBeNull();
    expect(chip.querySelector('.pin-dot')).toBeNull();
    localStorage.clear();
  });
});
