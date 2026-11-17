import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi, stubPendingApi } from '../../test/fakeApi';
import { stubLocation } from '../../test/location';
import { BasketProvider } from '../basket/BasketProvider';
import { MapPage } from './MapPage';

// Leaflet necesita un navegador de verdad para dibujar; aquí el mapa dice qué tiendas recibió.
vi.mock('./StoreMap', () => ({
  StoreMap: ({ stores }: { stores: { name: string }[]; label: string }) => (
    <p>{`Mapa con: ${stores.map(({ name }) => name).join(', ')}`}</p>
  ),
}));

const shop = (id: string, name: string, type = 'barrio', extra: Record<string, unknown> = {}) => ({
  id,
  name,
  type,
  lat: 4.5339,
  lng: -75.6811,
  municipality: 'armenia',
  ...extra,
});
const ara = shop('5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d', 'Ara', 'descuento');
const pepe = shop('6e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d1e', 'Tienda Don Pepe');

const renderMap = () =>
  render(
    <BasketProvider>
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>
    </BasketProvider>,
  );

describe('mapa de tiendas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sin ubicación muestra las tiendas del municipio en el mapa y en una lista', async () => {
    const api = stubApi({
      'GET /v1/establishments': { status: 200, body: { items: [ara, pepe] } },
    });

    renderMap();

    expect(await screen.findByText('Mapa con: Ara, Tienda Don Pepe')).toBeInTheDocument();
    const card = within(screen.getByRole('heading', { name: 'Ara' }).closest('li') as HTMLElement);
    expect(card.getByText('Descuento')).toBeInTheDocument();
    expect(card.getByRole('link', { name: 'Ver precios de Ara' })).toHaveAttribute(
      'href',
      `/tiendas/${ara.id}`,
    );
    expect(card.getByRole('link', { name: 'Cómo llegar a Ara' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=4.5339%2C-75.6811',
    );
    expect(screen.getByRole('link', { name: 'Sugerir una tienda que no aparece' })).toHaveAttribute(
      'href',
      '/proponer/tienda',
    );
    const asked = api.requested.find(({ pathname }) => pathname === '/v1/establishments');
    expect(asked?.searchParams.get('municipality')).toBe('armenia');
    expect(asked?.searchParams.get('limit')).toBe('50');
  });

  it('dice cuántas tiendas hay y que la ubicación no se guarda', async () => {
    stubApi({
      'GET /v1/establishments': { status: 200, body: { items: [ara, pepe] } },
      'GET /v1/establishments/nearby': {
        status: 200,
        body: { items: [{ ...pepe, distanceM: 350 }] },
      },
    });
    stubLocation();
    renderMap();

    expect(
      await screen.findByText('2 tiendas registradas en Valora en Armenia.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
    expect(
      await screen.findByText(
        '1 tienda registrada en Valora a menos de 1,5 km. Tu ubicación no se guarda.',
      ),
    ).toBeInTheDocument();
  });

  it('las tarjetas van en un panel al lado, con el color del tipo y cuánto cuesta allí tu canasta', async () => {
    localStorage.setItem(
      'valora:canasta',
      JSON.stringify([
        {
          productId: 'arroz',
          productName: 'Arroz',
          presentationId: 'arroz-500g',
          presentationLabel: '500 g',
          quantity: 2,
          bought: false,
        },
      ]),
    );
    stubApi({
      'GET /v1/establishments': { status: 200, body: { items: [ara, pepe] } },
      'GET /v1/products/arroz/comparison': {
        status: 200,
        body: {
          productId: 'arroz',
          criteria: { sort: 'unit_price', municipality: 'armenia' },
          results: [
            {
              establishment: ara,
              reportId: crypto.randomUUID(),
              presentationId: 'arroz-500g',
              priceCop: 2600,
              unitPrice: { valueCop: 520, per: '100g' },
              source: 'comunidad',
              freshness: 'vigente',
              reliability: 'alta',
              confirmations: 1,
              isCheapest: true,
              observedAt: new Date().toISOString(),
            },
          ],
        },
      },
    });

    renderMap();

    const side = await screen.findByRole('complementary', { name: 'Lista de tiendas' });
    expect(
      within(side).getByRole('link', { name: 'Sugerir una tienda que no aparece' }),
    ).toBeInTheDocument();
    const card = within(
      within(side).getByRole('heading', { name: 'Ara' }).closest('li') as HTMLElement,
    );
    expect(card.getByText('Descuento').previousElementSibling).toHaveClass('dot', 'type-descuento');
    expect(await card.findByText('$5.200')).toBeInTheDocument();
    expect(card.getByText(/1 de 1 productos/)).toBeInTheDocument();
    const other = within(
      within(side).getByRole('heading', { name: 'Tienda Don Pepe' }).closest('li') as HTMLElement,
    );
    expect(other.queryByText(/Tu canasta aquí/)).not.toBeInTheDocument();
  });

  it('cada tarjeta dice cuántos precios tiene la tienda', async () => {
    stubApi({
      'GET /v1/establishments': {
        status: 200,
        body: {
          items: [
            { ...ara, priceCount: 9 },
            { ...pepe, priceCount: 1 },
            shop('7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d', 'Granero Nuevo', 'barrio', {
              priceCount: 0,
            }),
          ],
        },
      },
    });

    renderMap();

    const cardOf = async (name: string) =>
      (await screen.findByRole('heading', { name })).closest('li') as HTMLElement;
    expect(await cardOf('Ara')).toHaveTextContent('9 precios');
    expect(await cardOf('Tienda Don Pepe')).toHaveTextContent('1 precio');
    expect(await cardOf('Granero Nuevo')).toHaveTextContent('Sin precios');
  });

  it('con 50 tiendas lo dice una sola vez, arriba, e invita a usar la ubicación', async () => {
    const fifty = Array.from({ length: 50 }, (_, index) =>
      shop(crypto.randomUUID(), `Tienda ${String(index + 1)}`),
    );
    stubApi({ 'GET /v1/establishments': { status: 200, body: { items: fifty } } });

    renderMap();

    expect(
      await screen.findByText(
        'Se muestran 50 tiendas de Armenia. Usa tu ubicación para ver las más cercanas.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/50 tiendas/)).toHaveLength(1);
  });

  it('se elige otro municipio y muestra sus tiendas', async () => {
    const api = stubApi({ 'GET /v1/establishments': { status: 200, body: { items: [pepe] } } });
    renderMap();
    await screen.findByRole('heading', { name: 'Tiendas en Armenia' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Municipio' }), {
      target: { value: 'calarca' },
    });

    expect(await screen.findByRole('heading', { name: 'Tiendas en Calarcá' })).toBeInTheDocument();
    const asked = api.requested.filter(({ pathname }) => pathname === '/v1/establishments').at(-1);
    expect(asked?.searchParams.get('municipality')).toBe('calarca');
  });

  it('con la ubicación muestra las tiendas cercanas, con su distancia y el radio', async () => {
    const api = stubApi({
      'GET /v1/establishments': { status: 200, body: { items: [ara] } },
      'GET /v1/establishments/nearby': {
        status: 200,
        body: { items: [{ ...pepe, distanceM: 350 }] },
      },
    });
    stubLocation();
    renderMap();

    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));

    expect(await screen.findByRole('heading', { name: 'Tiendas cerca de ti' })).toBeInTheDocument();
    expect(
      (await screen.findByRole('heading', { name: 'Tienda Don Pepe' })).closest('li'),
    ).toHaveTextContent('350 m');
    // El radio es el mismo en toda la app: chips de 0,5 a 3 km, 1,5 km por defecto.
    expect(screen.getByRole('radio', { name: '1,5 km' })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: '1 km' }));

    expect(screen.getByRole('radio', { name: '1 km' })).toBeChecked();
    await vi.waitFor(() => {
      const asked = api.requested.filter(({ pathname }) => pathname.endsWith('/nearby')).at(-1);
      expect(asked?.searchParams.get('radiusKm')).toBe('1');
    });
    // Se recuerda en el dispositivo para las demás pantallas.
    expect(localStorage.getItem('valora:radio')).toBe('1');
  });

  it('sin la ubicación no hay chips del radio', async () => {
    stubApi({ 'GET /v1/establishments': { status: 200, body: { items: [ara] } } });

    renderMap();

    await screen.findByText('Mapa con: Ara');
    expect(screen.queryByRole('radiogroup', { name: 'Radio de búsqueda' })).not.toBeInTheDocument();
  });

  it('si la última vez usó su ubicación, la vuelve a pedir y muestra las cercanas, sin guardar dónde está', async () => {
    localStorage.setItem('valora:donde', 'ubicacion');
    const api = stubApi({
      'GET /v1/establishments/nearby': {
        status: 200,
        body: { items: [{ ...pepe, distanceM: 350 }] },
      },
    });
    stubLocation();

    renderMap();

    expect(await screen.findByRole('heading', { name: 'Tiendas cerca de ti' })).toBeInTheDocument();
    expect(api.requested.some(({ pathname }) => pathname === '/v1/establishments')).toBe(false);
    const stored = Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? '');
    expect(stored.join(' ')).not.toMatch(/4\.53|-75\.68/);
  });

  it('usar la ubicación queda recordado, y volver al municipio también', async () => {
    stubApi({
      'GET /v1/establishments': { status: 200, body: { items: [ara] } },
      'GET /v1/establishments/nearby': { status: 200, body: { items: [] } },
    });
    stubLocation();
    renderMap();

    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));
    await screen.findByRole('heading', { name: 'Tiendas cerca de ti' });
    expect(localStorage.getItem('valora:donde')).toBe('ubicacion');

    fireEvent.click(screen.getByRole('button', { name: 'Ver por municipio' }));
    await screen.findByRole('heading', { name: 'Tiendas en Armenia' });
    expect(localStorage.getItem('valora:donde')).toBeNull();
  });

  it('la leyenda dice el color de cada tipo de tienda', async () => {
    stubApi({ 'GET /v1/establishments': { status: 200, body: { items: [ara] } } });

    renderMap();

    const legend = await screen.findByRole('list', { name: 'Colores del mapa' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map(({ textContent }) => textContent),
    ).toEqual(['Tienda de barrio', 'Minimercado', 'Supermercado', 'Descuento']);
  });

  it('mientras busca dice «Buscando tiendas…»', () => {
    stubPendingApi();

    renderMap();

    expect(screen.getByRole('status')).toHaveTextContent('Buscando tiendas…');
  });

  it('sin tiendas registradas lo dice', async () => {
    stubApi({ 'GET /v1/establishments': { status: 200, body: { items: [] } } });

    renderMap();

    expect(
      await screen.findByText('Todavía no hay tiendas registradas en Armenia.'),
    ).toBeInTheDocument();
  });

  it('si la búsqueda falla muestra el error y permite reintentar', async () => {
    stubApi({
      'GET /v1/establishments': [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        { status: 200, body: { items: [ara] } },
      ],
    });
    renderMap();

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Ara' })).toBeInTheDocument();
  });
});
