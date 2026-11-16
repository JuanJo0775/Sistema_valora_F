import { fireEvent, render, screen, within } from '@testing-library/react';
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

// El teléfono responde la ubicación al instante.
const stubLocation = () => {
  const geolocation = {
    getCurrentPosition: (ok: PositionCallback) => {
      ok({ coords: { latitude: 4.53, longitude: -75.68 } } as GeolocationPosition);
    },
  };
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator) as Navigator, { geolocation }));
};

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

  it('cada precio dice su vigencia, su confiabilidad, su fuente y si es el más barato', async () => {
    stubCompare(
      comparison([
        result({ isCheapest: true }),
        result({
          reportId: '8f7e6d5c-4b3a-4291-8a0f-7e6d5c4b3a29',
          establishment: store('6e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d1e', 'Minimercado La 14'),
          priceCop: 4400,
          unitPrice: { valueCop: 440, per: '100g' },
          presentationId: rice.presentations[1]?.id,
          reliability: 'media',
        }),
      ]),
    );

    renderCompare();

    const [cheapest, other] = await screen.findAllByRole('listitem');
    expect(cheapest).toHaveTextContent('Más barato');
    expect(cheapest).toHaveTextContent('Hoy');
    expect(cheapest).toHaveTextContent('Confiabilidad alta');
    expect(cheapest).toHaveTextContent('Comunidad');
    expect(other).not.toHaveTextContent('Más barato');
    expect(other).toHaveTextContent('Confiabilidad media');
  });

  it.each([
    [
      { sort: 'unit_price', municipality: 'armenia' },
      'Ordenado por precio por unidad · en Armenia',
    ],
    [{ sort: 'recent', municipality: 'calarca' }, 'Ordenado por los más recientes · en Calarcá'],
    [
      { sort: 'distance', municipality: undefined, radiusKm: 2 },
      'Ordenado por distancia · a menos de 2 km de ti',
    ],
  ])('dice el criterio que declaró la API (%o)', async (criteria, text) => {
    stubCompare(comparison([result()], criteria));

    renderCompare();

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('ordenar por los más recientes vuelve a pedir la comparación con ese criterio', async () => {
    const api = stubCompare([comparison([result()]), comparison([result()], { sort: 'recent' })]);
    renderCompare();
    await screen.findByText('Ordenado por precio por unidad · en Armenia');

    fireEvent.click(screen.getByRole('radio', { name: 'Más recientes' }));

    expect(
      await screen.findByText('Ordenado por los más recientes · en Armenia'),
    ).toBeInTheDocument();
    const asked = api.requested.filter(({ pathname }) => pathname.endsWith('/comparison'));
    expect(asked.at(-1)?.searchParams.get('sort')).toBe('recent');
    expect(screen.getByRole('radio', { name: 'Distancia' })).toBeDisabled();
  });

  it('«Usar mi ubicación» compara cerca de ti, dice la distancia y permite ordenar por ella', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison(
        [
          result({
            establishment: {
              ...store('5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d', 'Tienda Don Pepe'),
              distanceM: 350,
            },
          }),
        ],
        { municipality: undefined, radiusKm: 2 },
      ),
    ]);
    stubLocation();
    renderCompare();

    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));

    expect(
      await screen.findByText('Ordenado por precio por unidad · a menos de 2 km de ti'),
    ).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('350 m');
    expect(screen.getByRole('radio', { name: 'Distancia' })).toBeEnabled();
    const asked = api.requested.filter(({ pathname }) => pathname.endsWith('/comparison')).at(-1);
    expect(asked?.searchParams.get('lat')).toBe('4.53');
    expect(asked?.searchParams.has('municipality')).toBe(false);
  });

  it('si se niega la ubicación lo dice y sigue comparando en Armenia', async () => {
    stubCompare(comparison([result()]));
    vi.stubGlobal(
      'navigator',
      Object.assign(Object.create(navigator) as Navigator, { geolocation: undefined }),
    );
    renderCompare();

    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Activa la ubicación del navegador para ver las tiendas cercanas.',
    );
    expect(screen.getByText('Ordenado por precio por unidad · en Armenia')).toBeInTheDocument();
  });

  it('«Solo precios vigentes» vuelve a pedir la comparación sin los viejos', async () => {
    const api = stubCompare(comparison([result()]));
    renderCompare();
    await screen.findByRole('listitem');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Solo precios vigentes' }));

    await vi.waitFor(() => {
      const asked = api.requested.filter(({ pathname }) => pathname.endsWith('/comparison')).at(-1);
      expect(asked?.searchParams.get('onlyCurrent')).toBe('true');
    });
  });

  it('los precios desactualizados o en revisión van aparte, porque no compiten', async () => {
    stubCompare(
      comparison([
        result(),
        result({
          reportId: '8f7e6d5c-4b3a-4291-8a0f-7e6d5c4b3a29',
          establishment: store('6e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d1e', 'Minimercado La 14'),
          freshness: 'desactualizado',
        }),
        result({
          reportId: '9a8f7e6d-5c4b-43a2-9b1a-8f7e6d5c4b3a',
          establishment: store('7f4e3d2c-1b0a-4c9d-8e7f-6a5b4c3d2e1f', 'Supermercado Éxito'),
          reliability: 'en_revision',
        }),
      ]),
    );

    renderCompare();

    const [current, old] = await screen.findAllByRole('list');
    expect(within(current as HTMLElement).getAllByRole('listitem')).toHaveLength(1);
    expect(
      screen.getByRole('heading', { name: 'Precios viejos o en revisión' }),
    ).toBeInTheDocument();
    expect(old).toHaveTextContent('Minimercado La 14');
    expect(old).toHaveTextContent('Supermercado Éxito');
  });

  it('«Cómo llegar» abre la app de mapas con las coordenadas de la tienda', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    const link = await screen.findByRole('link', { name: 'Cómo llegar a Tienda Don Pepe' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=4.5339%2C-75.6811',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
