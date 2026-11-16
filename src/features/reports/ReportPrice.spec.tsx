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

const receipt = {
  id: '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918',
  status: 'recibido',
  receivedAt: '2026-11-16T15:00:00Z',
};

const reportRoutes = {
  ...productRoute,
  'GET /v1/establishments/nearby': { status: 200, body: { items: [donPepe] } },
  'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
  'POST /v1/reports': { status: 201, body: receipt },
};

// Lo que hace quien reporta: presentación, tienda cercana, precio y «Enviar».
const fillAndSend = async (price = '2500') => {
  fireEvent.click(await screen.findByRole('radio', { name: '500 g' }));
  stubLocation('allow');
  fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
  fireEvent.click(await screen.findByRole('radio', { name: /Tienda Don Pepe/ }));
  fireEvent.change(screen.getByLabelText('Precio en pesos'), { target: { value: price } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
};

const sentReports = (api: ReturnType<typeof stubApi>) =>
  api.calls.filter(({ method, path }) => method === 'POST' && path === '/v1/reports');

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
    localStorage.clear();
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

  it('envía presentación, tienda, precio y hora con su clave, sin la ubicación, y dice «Recibido»', async () => {
    const api = stubApi(reportRoutes);
    renderReport();

    await fillAndSend();

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
    const [report] = sentReports(api);
    const body = JSON.parse(report?.body ?? '{}') as Record<string, unknown>;
    expect(body).toMatchObject({
      presentationId: rice.presentations[0]?.id,
      establishmentId: donPepe.id,
      priceCop: 2500,
      priceType: 'normal',
    });
    expect(Date.now() - Date.parse(String(body['observedAt']))).toBeLessThan(60_000);
    expect(Object.keys(body)).not.toContain('lat');
    expect(report?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('el precio se puede escribir con puntos de miles: «2.500» son 2500 pesos', async () => {
    const api = stubApi(reportRoutes);
    renderReport();

    await fillAndSend('2.500');

    await screen.findByRole('heading', { name: 'Recibido' });
    expect(JSON.parse(sentReports(api)[0]?.body ?? '{}')).toMatchObject({ priceCop: 2500 });
  });

  it.each([
    ['la presentación', { size: false, store: true, price: '2500' }, 'Elige la presentación.'],
    ['la tienda', { size: true, store: false, price: '2500' }, 'Elige la tienda.'],
    ['el precio', { size: true, store: true, price: '' }, 'Escribe el precio en pesos.'],
    ['un precio válido', { size: true, store: true, price: '2,5' }, 'Escribe el precio en pesos.'],
  ])('sin %s dice qué falta y no envía', async (_missing, steps, message) => {
    const api = stubApi(reportRoutes);
    renderReport();
    await screen.findByRole('heading', { name: 'Arroz blanco' });

    if (steps.size) fireEvent.click(screen.getByRole('radio', { name: '500 g' }));
    if (steps.store) {
      stubLocation('allow');
      fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
      fireEvent.click(await screen.findByRole('radio', { name: /Tienda Don Pepe/ }));
    }
    fireEvent.change(screen.getByLabelText('Precio en pesos'), { target: { value: steps.price } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(sentReports(api)).toHaveLength(0);
  });

  it('«Es oferta» envía el precio como oferta', async () => {
    const api = stubApi(reportRoutes);
    renderReport();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Es oferta' }));

    await fillAndSend();

    await screen.findByRole('heading', { name: 'Recibido' });
    expect(JSON.parse(sentReports(api)[0]?.body ?? '{}')).toMatchObject({ priceType: 'oferta' });
  });

  it('si el envío falla muestra el error y al reintentar usa la misma clave', async () => {
    const api = stubApi({
      ...reportRoutes,
      'POST /v1/reports': [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        { status: 201, body: receipt },
      ],
    });
    renderReport();
    await fillAndSend();

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await screen.findByRole('heading', { name: 'Recibido' });
    const [first, retry] = sentReports(api).map(({ headers }) => headers.get('Idempotency-Key'));
    expect(retry).toBe(first);
  });

  it('el reintento envía exactamente el mismo reporte, con la misma hora', async () => {
    const api = stubApi({
      ...reportRoutes,
      'POST /v1/reports': [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        { status: 201, body: receipt },
      ],
    });
    renderReport();
    await fillAndSend();
    await screen.findByRole('alert');
    await new Promise((resolve) => setTimeout(resolve, 5));

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await screen.findByRole('heading', { name: 'Recibido' });
    const [first, retry] = sentReports(api).map(({ body }) => body);
    expect(retry).toBe(first);
  });

  it('si después de un fallo cambia el reporte, lo envía con una clave nueva', async () => {
    const api = stubApi({
      ...reportRoutes,
      'POST /v1/reports': [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        { status: 201, body: receipt },
      ],
    });
    renderReport();
    await fillAndSend('2500');
    await screen.findByRole('alert');

    fireEvent.change(screen.getByLabelText('Precio en pesos'), { target: { value: '2600' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await screen.findByRole('heading', { name: 'Recibido' });
    const [first, second] = sentReports(api).map(({ headers }) => headers.get('Idempotency-Key'));
    expect(second).not.toBe(first);
  });

  it('mientras envía el botón dice «Enviando…» y no se reenvía', async () => {
    stubApi({ ...reportRoutes, 'POST /v1/reports': { status: 201, pending: true } });
    renderReport();

    await fillAndSend();

    expect(await screen.findByRole('button', { name: 'Enviando…' })).toBeDisabled();
  });

  it('sin producto pregunta qué precio viste y cada resultado vuelve al registro', async () => {
    stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice] } } });
    renderReport('/registrar');

    expect(screen.getByRole('heading', { name: '¿Qué precio viste?' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar producto' }), {
      target: { value: 'arroz' },
    });
    fireEvent.submit(screen.getByRole('search'));

    expect(await screen.findByRole('link', { name: /Arroz blanco/ })).toHaveAttribute(
      'href',
      `/registrar?producto=${rice.id}`,
    );
  });

  it('recuerda la última tienda: el siguiente reporte ya la trae elegida', async () => {
    stubApi(reportRoutes);
    const first = renderReport();
    await fillAndSend();
    await screen.findByRole('heading', { name: 'Recibido' });
    first.unmount();

    renderReport();

    expect(await screen.findByRole('radio', { name: /Tienda Don Pepe/ })).toBeChecked();
  });

  it('después de «Recibido» se puede registrar otro producto en la misma tienda', async () => {
    stubApi(reportRoutes);
    renderReport();

    await fillAndSend();

    expect(
      await screen.findByRole('link', { name: 'Registrar otro en esta tienda' }),
    ).toHaveAttribute('href', '/registrar');
  });
});
