import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../auth/SessionProvider';
import { sessionAs, stubApi, stubPendingApi } from '../../test/fakeApi';
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

// Con la sesión: el detalle muestra acciones según el rol.
const renderWithSession = (productId: string) =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[`/productos/${productId}`]}>
        <Routes>
          <Route path="/productos/:productId" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

describe('detalle del producto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('un moderador cambia la foto y el detalle muestra la nueva', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`PUT /v1/moderation/products/${rice.id}/image`]: {
        status: 200,
        body: {
          url: 'http://localhost/media/arroz.webp',
          source: 'equipo',
          attribution: 'Equipo Valora',
        },
      },
    });
    renderWithSession(rice.id);

    fireEvent.change(await screen.findByLabelText('Cambiar foto'), {
      target: { files: [new File(['foto'], 'arroz.jpg', { type: 'image/jpeg' })] },
    });

    expect(await screen.findByRole('img', { name: 'Arroz blanco' })).toHaveAttribute(
      'src',
      'http://localhost/media/arroz.webp',
    );
  });

  it('quien no es moderador no puede cambiar la foto', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
    });
    renderWithSession(rice.id);

    await screen.findByRole('heading', { name: 'Arroz blanco' });

    expect(screen.queryByLabelText('Cambiar foto')).not.toBeInTheDocument();
  });

  it('muestra el nombre, la marca, la categoría y las presentaciones', async () => {
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });

    renderDetail(rice.id);

    expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
    expect(screen.getByText('Granos y abarrotes')).toBeInTheDocument();
    expect(screen.getByText('500 g, 1 kg')).toBeInTheDocument();
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
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelector('.skeleton-photo')).toBeInTheDocument();
  });

  it('el encabezado dice la categoría, las presentaciones y en cuántas tiendas hay precio', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: comparisonOf([
        offer('Ara', 2000, true),
        offer('D1', 2100),
      ]),
    });

    renderDetail(rice.id);

    expect(await screen.findByText('500 g, 1 kg · 2 tiendas en Armenia')).toBeInTheDocument();
    expect(screen.getByText('Granos y abarrotes')).toHaveClass('eyebrow');
  });

  it('el panel lleva el más barato, registrar un precio de este producto y la canasta', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: comparisonOf([
        offer('D1', 2100),
        offer('Ara', 2000, true),
      ]),
    });

    renderDetail(rice.id);

    const side = await screen.findByRole('complementary', { name: 'Precios y acciones' });
    const cheapest = await within(side).findByRole('region', { name: 'Más barato en Armenia' });
    expect(cheapest).toHaveTextContent('$2.000');
    expect(cheapest).toHaveTextContent('Ara');
    expect(cheapest).toHaveTextContent('$400 por 100 g');
    expect(
      within(side).getByRole('link', { name: 'Registrar un precio de Arroz blanco' }),
    ).toHaveAttribute('href', `/registrar?producto=${rice.id}`);
    expect(within(side).getByRole('button', { name: 'Agregar a la canasta' })).toBeInTheDocument();
  });

  it('el más barato dice cuánto menos cuesta que la tienda más cara', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: {
        status: 200,
        body: {
          ...comparisonOf([offer('Ara', 2000, true), offer('D1', 2350)]).body,
          savingsPercent: 15,
        },
      },
    });

    renderDetail(rice.id);

    expect(await screen.findByText('Hasta 15 % menos que la tienda más cara.')).toBeInTheDocument();
  });

  it('el panel va en orden: más barato, presentación, agregar (primario) y registrar (secundario)', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: comparisonOf([offer('Ara', 2000, true)]),
    });

    renderDetail(rice.id);

    const side = await screen.findByRole('complementary', { name: 'Precios y acciones' });
    await within(side).findByRole('region', { name: 'Más barato en Armenia' });
    const add = within(side).getByRole('button', { name: 'Agregar a la canasta' });
    const register = within(side).getByRole('link', {
      name: 'Registrar un precio de Arroz blanco',
    });
    expect(add).not.toHaveClass('ghost');
    expect(register).toHaveClass('btn', 'ghost');
    const group = within(side).getByRole('radiogroup', { name: 'Presentación' });
    const region = within(side).getByRole('region', { name: 'Más barato en Armenia' });
    const before = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(region, group)).toBe(true);
    expect(before(group, add)).toBe(true);
    expect(before(add, register)).toBe(true);
  });

  it('la presentación del más barato llega marcada y el precio dice a cuál corresponde', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: comparisonOf([offer('Ara', 2000, true)]),
    });

    renderDetail(rice.id);

    const side = await screen.findByRole('complementary', { name: 'Precios y acciones' });
    const cheapest = await within(side).findByRole('region', { name: 'Más barato en Armenia' });
    expect(cheapest).toHaveTextContent('Presentación de 500 g');
    expect(within(side).getByRole('radio', { name: '500 g' })).toBeChecked();
  });

  it('con un ahorro de 0 % no dice «Hasta 0 % menos»', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: {
        status: 200,
        body: {
          ...comparisonOf([offer('Ara', 2000, true), offer('D1', 2000)]).body,
          savingsPercent: 0,
        },
      },
    });

    renderDetail(rice.id);

    await screen.findByRole('region', { name: 'Más barato en Armenia' });
    expect(screen.queryByText(/menos que la tienda más cara/)).not.toBeInTheDocument();
  });

  it('sin precios el panel no muestra el más barato', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: comparisonOf([]),
    });

    renderDetail(rice.id);

    await screen.findByRole('heading', { name: /Todavía nadie ha reportado/ });
    expect(screen.queryByRole('region', { name: /Más barato/ })).not.toBeInTheDocument();
  });

  it('muestra la foto del producto, o la ilustración si no tiene', async () => {
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });

    renderDetail(rice.id);

    expect(await screen.findByRole('img', { name: 'Arroz blanco (sin foto)' })).toBeInTheDocument();
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

    expect(await screen.findByText('Ocurrió un error inesperado.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
  });

  it('los precios y las acciones van en un panel aparte del producto', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/comparison`]: comparisonOf([offer('Ara', 2000, true)]),
    });

    renderDetail(rice.id);

    const side = await screen.findByRole('complementary', { name: 'Precios y acciones' });
    expect(within(side).queryByRole('heading', { name: 'Arroz blanco' })).not.toBeInTheDocument();
    expect(
      within(side).queryByRole('region', { name: 'Todas las tiendas' }),
    ).not.toBeInTheDocument();
  });

  it('el panel muestra la gráfica de los últimos 30 días y lleva al historial', async () => {
    stubApi({
      [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
      [`GET /v1/products/${rice.id}/history`]: {
        status: 200,
        body: {
          from: '2026-10-18',
          to: '2026-11-16',
          presentations: [
            {
              presentationId: rice.presentations[0]?.id,
              label: '500 g',
              points: [
                {
                  date: '2026-11-15',
                  minPriceCop: 2400,
                  avgPriceCop: 2400,
                  reports: 1,
                  source: 'reportado',
                },
                {
                  date: '2026-11-16',
                  minPriceCop: 2300,
                  avgPriceCop: 2300,
                  reports: 1,
                  source: 'reportado',
                },
              ],
            },
          ],
        },
      },
    });

    renderDetail(rice.id);

    const side = await screen.findByRole('complementary', { name: 'Precios y acciones' });
    expect(
      await within(side).findByRole('img', {
        name: 'Precio más bajo por día · 500 g: de $2.400 el 15 nov a $2.300 el 16 nov',
      }),
    ).toBeInTheDocument();
    expect(within(side).getByRole('link', { name: 'Ver el historial' })).toHaveAttribute(
      'href',
      `/productos/${rice.id}/historial`,
    );
  });
});
