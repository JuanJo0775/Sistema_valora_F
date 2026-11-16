import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi, stubPendingApi } from '../../test/fakeApi';
import { ProductDetail } from './ProductDetail';

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

const offer = (name: string, priceCop: number, isCheapest = false) => ({
  establishment: {
    id: crypto.randomUUID(),
    name,
    type: 'barrio',
    lat: 4.5339,
    lng: -75.6811,
    municipality: 'armenia',
  },
  reportId: crypto.randomUUID(),
  presentationId: rice.presentations[0]?.id,
  priceCop,
  unitPrice: { valueCop: priceCop / 5, per: '100g' },
  source: 'comunidad',
  freshness: 'vigente',
  reliability: 'alta',
  confirmations: 1,
  isCheapest,
  observedAt: new Date().toISOString(),
});

const comparisonOf = (results: unknown[]) => ({
  status: 200,
  body: {
    productId: rice.id,
    criteria: { sort: 'unit_price', municipality: 'armenia' },
    results,
    promotions: [],
  },
});

const renderDetail = (productId: string) =>
  render(
    <MemoryRouter initialEntries={[`/productos/${productId}`]}>
      <Routes>
        <Route path="/productos/:productId" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe('detalle del producto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('muestra el nombre, la marca, la categoría y las presentaciones', async () => {
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });

    renderDetail(rice.id);

    expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
    expect(screen.getByText('Diana · Granos y abarrotes')).toBeInTheDocument();
    const presentations = screen.getByRole('list', { name: 'Presentaciones' });
    expect(presentations).toHaveTextContent('500 g');
    expect(presentations).toHaveTextContent('1 kg');
  });

  it('si el producto no existe lo dice y ofrece volver a buscar', async () => {
    stubApi({});

    renderDetail(rice.id);

    expect(
      await screen.findByRole('heading', { name: 'No encontramos este producto' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar otro producto' })).toHaveAttribute('href', '/');
  });

  it('sin conexión muestra el error con «Reintentar», no «no existe»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    renderDetail(rice.id);

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión con Valora');
    expect(screen.queryByText('No encontramos este producto')).not.toBeInTheDocument();
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
  });

  it('mientras llega el producto dice «Cargando…»', () => {
    stubPendingApi();

    renderDetail(rice.id);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('desde el detalle se puede comparar precios, ver el historial y registrar un precio', async () => {
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });

    renderDetail(rice.id);

    expect(await screen.findByRole('link', { name: 'Comparar precios' })).toHaveAttribute(
      'href',
      `/productos/${rice.id}/comparar`,
    );
    expect(screen.getByRole('link', { name: 'Historial' })).toHaveAttribute(
      'href',
      `/productos/${rice.id}/historial`,
    );
    expect(screen.getByRole('link', { name: 'Registrar un precio' })).toHaveAttribute(
      'href',
      `/registrar?producto=${rice.id}`,
    );
  });

  it('muestra la foto del producto, o la ilustración si no tiene', async () => {
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });

    renderDetail(rice.id);

    expect(await screen.findByRole('img', { name: 'Arroz blanco (sin foto)' })).toBeInTheDocument();
  });

  it('muestra los 3 precios más baratos y lleva a ver todas las tiendas', async () => {
    const api = stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: comparisonOf([
        offer('Ara', 2000, true),
        offer('D1', 2100),
        offer('Tienda Don Pepe', 2300),
        offer('Éxito', 2600),
      ]),
    });

    renderDetail(rice.id);

    const cheapest = await screen.findByRole('list', { name: 'Más baratos en Armenia' });
    const names = within(cheapest)
      .getAllByRole('heading')
      .map(({ textContent }) => textContent);
    expect(names).toEqual(['Ara', 'D1', 'Tienda Don Pepe']);
    expect(cheapest).toHaveTextContent('Más barato');
    expect(screen.getByRole('link', { name: 'Ver todas las tiendas' })).toHaveAttribute(
      'href',
      `/productos/${rice.id}/comparar`,
    );
    const asked = api.requested.find(({ pathname }) => pathname.endsWith('/comparison'));
    expect(asked?.searchParams.get('onlyCurrent')).toBe('true');
  });

  it('sin precios vigentes en Armenia lo dice', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: comparisonOf([]),
    });

    renderDetail(rice.id);

    expect(
      await screen.findByText('Todavía no hay precios vigentes de este producto en Armenia.'),
    ).toBeInTheDocument();
  });

  it('si los precios no cargan lo dice y el producto se sigue viendo', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: {
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
      },
    });

    renderDetail(rice.id);

    expect(await screen.findByText('No pudimos cargar los precios.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
  });

  it('los más baratos son del municipio que se eligió al comparar', async () => {
    localStorage.setItem('valora:municipio', 'calarca');
    const api = stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: comparisonOf([offer('Ara', 2000, true)]),
    });

    renderDetail(rice.id);

    expect(await screen.findByRole('list', { name: 'Más baratos en Calarcá' })).toBeInTheDocument();
    const asked = api.requested.find(({ pathname }) => pathname.endsWith('/comparison'));
    expect(asked?.searchParams.get('municipality')).toBe('calarca');
  });

  // #48: en escritorio el panel derecho lleva los más baratos y las acciones.
  it('los precios y las acciones van en un panel aparte del producto', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: comparisonOf([offer('Ara', 2000, true)]),
    });

    renderDetail(rice.id);

    const side = await screen.findByRole('complementary', { name: 'Precios y acciones' });
    expect(
      await within(side).findByRole('list', { name: 'Más baratos en Armenia' }),
    ).toBeInTheDocument();
    expect(within(side).getByRole('link', { name: 'Comparar precios' })).toBeInTheDocument();
    expect(within(side).getByRole('link', { name: 'Registrar un precio' })).toBeInTheDocument();
    expect(within(side).queryByRole('heading', { name: 'Arroz blanco' })).not.toBeInTheDocument();
  });
});
