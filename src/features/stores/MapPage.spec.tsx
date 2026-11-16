import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
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
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
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
    const asked = api.requested.find(({ pathname }) => pathname === '/v1/establishments');
    expect(asked?.searchParams.get('municipality')).toBe('armenia');
    expect(asked?.searchParams.get('limit')).toBe('50');
  });
});
