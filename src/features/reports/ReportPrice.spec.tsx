import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { ReportPrice } from './ReportPrice';

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

const donPepe = {
  id: '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
  name: 'Tienda Don Pepe',
  type: 'barrio',
  lat: 4.5339,
  lng: -75.6811,
  municipality: 'armenia',
  distanceM: 350,
};

// El teléfono responde la ubicación al instante, o la niega.
const stubLocation = (answer: 'allow' | 'deny') => {
  const geolocation = {
    getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) => {
      if (answer === 'allow') {
        ok({ coords: { latitude: 4.53, longitude: -75.68 } } as GeolocationPosition);
      } else {
        fail({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError);
      }
    },
  };
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator) as Navigator, { geolocation }));
};

const productRoute = { [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } };

const renderReport = (path = `/registrar?producto=${rice.id}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/registrar" element={<ReportPrice />} />
      </Routes>
    </MemoryRouter>,
  );

describe('registrar un precio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con el producto en la dirección lo muestra con sus presentaciones para elegir', async () => {
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });

    renderReport();

    expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
    const sizes = screen.getByRole('radiogroup', { name: 'Presentación' });
    expect(sizes).toHaveTextContent('500 g');
    expect(sizes).toHaveTextContent('1 kg');
  });

  it('«Usar mi ubicación» muestra las tiendas cercanas con su distancia', async () => {
    const api = stubApi({
      ...productRoute,
      'GET /v1/establishments/nearby': { status: 200, body: { items: [donPepe] } },
    });
    stubLocation('allow');
    renderReport();

    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));

    const stores = await screen.findByRole('radiogroup', { name: 'Tienda' });
    expect(stores).toHaveTextContent('Tienda Don Pepe');
    expect(stores).toHaveTextContent('350 m');
    const nearby = api.requested.find(({ pathname }) => pathname.endsWith('/nearby'));
    expect(nearby?.searchParams.get('lat')).toBe('4.53');
  });

  it('si se niega la ubicación pide activarla para ver las tiendas cercanas', async () => {
    stubApi(productRoute);
    stubLocation('deny');
    renderReport();

    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Activa la ubicación del navegador para ver las tiendas cercanas.',
    );
  });
});
