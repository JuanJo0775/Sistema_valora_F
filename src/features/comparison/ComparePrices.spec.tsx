import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, stubApi, stubPendingApi } from '../../test/fakeApi';
import { stubLocation, stubNoGeolocation } from '../../test/location';
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

// La última consulta que hizo la pantalla a la comparación.
const lastAsked = (api: ReturnType<typeof stubApi>) =>
  api.requested.filter(({ pathname }) => pathname.endsWith('/comparison')).at(-1);

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
    localStorage.clear();
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
    const asked = lastAsked(api);
    expect(asked?.searchParams.get('lat')).toBe('4.53');
    expect(asked?.searchParams.has('municipality')).toBe(false);
  });

  it('si se niega la ubicación lo dice y sigue comparando en Armenia', async () => {
    stubCompare(comparison([result()]));
    stubNoGeolocation();
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
      const asked = lastAsked(api);
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

  it('mientras llega la comparación dice «Cargando…»', () => {
    stubPendingApi();

    renderCompare();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('sin precios lo dice e invita a registrar el primero', async () => {
    stubCompare(comparison([]));

    renderCompare();

    expect(
      await screen.findByRole('heading', {
        name: 'Todavía nadie ha reportado este producto en Armenia',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar un precio' })).toHaveAttribute(
      'href',
      `/registrar?producto=${rice.id}`,
    );
  });

  it('si la comparación falla muestra el error y «Reintentar» la vuelve a pedir', async () => {
    stubCompare([
      { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
      comparison([result()]),
    ]);
    renderCompare();

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Tienda Don Pepe' })).toBeInTheDocument();
  });

  // #15: comparar en cualquier municipio del Quindío, sin pedir la ubicación (EC-08).
  it('se elige el municipio y la comparación se hace allí', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison([result()], { municipality: 'calarca' }),
    ]);
    renderCompare();
    const where = await screen.findByRole('combobox', { name: 'Municipio' });
    expect(within(where).getAllByRole('option')).toHaveLength(12);

    fireEvent.change(where, { target: { value: 'calarca' } });

    expect(
      await screen.findByText('Ordenado por precio por unidad · en Calarcá'),
    ).toBeInTheDocument();
    const asked = lastAsked(api);
    expect(asked?.searchParams.get('municipality')).toBe('calarca');
  });

  it('con la ubicación se elige el radio y la comparación lo usa', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison([result()], { municipality: undefined, radiusKm: 2 }),
      comparison([result()], { municipality: undefined, radiusKm: 0.5 }),
    ]);
    stubLocation();
    renderCompare();
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));
    const radius = await screen.findByRole('combobox', { name: 'Radio' });
    expect(radius).toHaveValue('2');

    fireEvent.change(radius, { target: { value: '0.5' } });

    expect(
      await screen.findByText('Ordenado por precio por unidad · a menos de 0,5 km de ti'),
    ).toBeInTheDocument();
    const asked = lastAsked(api);
    expect(asked?.searchParams.get('radiusKm')).toBe('0.5');
  });

  it('con la ubicación no se elige municipio, y se puede volver a comparar por municipio', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison([result()], { municipality: undefined, radiusKm: 2 }),
      comparison([result()]),
    ]);
    stubLocation();
    renderCompare();
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));
    await screen.findByRole('combobox', { name: 'Radio' });
    expect(screen.queryByRole('combobox', { name: 'Municipio' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Comparar por municipio' }));

    expect(await screen.findByRole('combobox', { name: 'Municipio' })).toHaveValue('armenia');
    const asked = lastAsked(api);
    expect(asked?.searchParams.has('lat')).toBe(false);
  });

  it('al volver al municipio, el orden por distancia pasa a precio por unidad', async () => {
    const api = stubCompare(comparison([result()]));
    stubLocation();
    renderCompare();
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Distancia' }));

    fireEvent.click(screen.getByRole('button', { name: 'Comparar por municipio' }));

    await screen.findByRole('combobox', { name: 'Municipio' });
    const asked = lastAsked(api);
    expect(asked?.searchParams.get('sort')).toBe('unit_price');
  });

  it('recuerda el municipio elegido para la próxima vez', async () => {
    stubCompare(comparison([result()]));
    const first = renderCompare();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Municipio' }), {
      target: { value: 'calarca' },
    });
    first.unmount();

    renderCompare();

    expect(await screen.findByRole('combobox', { name: 'Municipio' })).toHaveValue('calarca');
  });

  // #16 / RF-014: la referencia mayorista del DANE va aparte; nunca es precio de una tienda.
  const wholesale = {
    source: 'SIPSA (DANE)',
    productName: 'Arroz blanco',
    market: 'Armenia, Mercar',
    pricePerKgCop: 3800,
    periodStart: '2026-11-02',
    periodEnd: '2026-11-08',
    url: 'https://www.dane.gov.co/sipsa/boletin.pdf',
  };

  it('la referencia mayorista SIPSA va aparte, fuera de la lista de tiendas', async () => {
    stubCompare({
      status: 200,
      body: { ...comparison([result()]).body, wholesaleReference: wholesale },
    });

    renderCompare();

    const reference = await screen.findByRole('region', { name: 'Referencia mayorista' });
    expect(reference).toHaveTextContent('$3.800 por kilo');
    expect(reference).toHaveTextContent('Armenia, Mercar · del 2 al 8 de noviembre de 2026');
    expect(reference).toHaveTextContent('SIPSA (DANE). No es el precio de una tienda.');
    expect(within(reference).getByRole('link', { name: 'Ver el boletín' })).toHaveAttribute(
      'href',
      wholesale.url,
    );
    const [stores] = screen.getAllByRole('list');
    expect(stores).not.toHaveTextContent('3.800');
  });

  it('sin referencia mayorista no muestra esa sección', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    await screen.findByRole('heading', { name: 'Tienda Don Pepe' });
    expect(screen.queryByRole('region', { name: 'Referencia mayorista' })).not.toBeInTheDocument();
  });

  it('sin precios de tiendas igual muestra la referencia mayorista, con su periodo', async () => {
    stubCompare({
      status: 200,
      body: {
        ...comparison([]).body,
        wholesaleReference: { ...wholesale, periodStart: '2026-10-30', periodEnd: '2026-11-05' },
      },
    });

    renderCompare();

    expect(
      await screen.findByRole('heading', {
        name: 'Todavía nadie ha reportado este producto en Armenia',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Referencia mayorista' })).toHaveTextContent(
      'del 30 de octubre al 5 de noviembre de 2026',
    );
  });

  it('el nombre de cada tienda lleva a su página con todos sus precios', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    expect(await screen.findByRole('link', { name: 'Tienda Don Pepe' })).toHaveAttribute(
      'href',
      '/tiendas/5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
    );
  });
});
