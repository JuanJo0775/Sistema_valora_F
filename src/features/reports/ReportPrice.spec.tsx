import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi, stubPendingApi } from '../../test/fakeApi';
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

// Una hora como la escribe el campo datetime-local: «2026-11-16T09:30», en la hora del teléfono.
const localTime = (date: Date) => {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
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

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Activa la ubicación del navegador o busca la tienda por su nombre.',
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

  it('la tienda recordada no muestra la distancia de la vez anterior', async () => {
    stubApi(reportRoutes);
    const first = renderReport();
    await fillAndSend();
    await screen.findByRole('heading', { name: 'Recibido' });
    first.unmount();

    renderReport();

    const stores = await screen.findByRole('radiogroup', { name: 'Tienda' });
    expect(stores).not.toHaveTextContent('350 m');
  });

  it('después de «Recibido» se puede registrar otro producto en la misma tienda', async () => {
    stubApi(reportRoutes);
    renderReport();

    await fillAndSend();

    expect(
      await screen.findByRole('link', { name: 'Registrar otro en esta tienda' }),
    ).toHaveAttribute('href', '/registrar');
  });

  it('«Lo vi antes» permite elegir la hora en que se vio el precio', async () => {
    const api = stubApi(reportRoutes);
    renderReport();
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    fireEvent.click(await screen.findByRole('button', { name: 'Lo vi antes' }));
    fireEvent.change(screen.getByLabelText('¿Cuándo lo viste?'), {
      target: { value: localTime(twoHoursAgo) },
    });

    await fillAndSend();

    await screen.findByRole('heading', { name: 'Recibido' });
    const body = JSON.parse(sentReports(api)[0]?.body ?? '{}') as { observedAt: string };
    expect(Math.abs(Date.parse(body.observedAt) - twoHoursAgo.getTime())).toBeLessThan(60_000);
  });

  it.each([
    ['de hace más de 24 horas', -25 * 3600_000],
    ['en el futuro', 2 * 3600_000],
  ])('una hora %s se avisa sin enviar', async (_when, offset) => {
    const api = stubApi(reportRoutes);
    renderReport();
    fireEvent.click(await screen.findByRole('button', { name: 'Lo vi antes' }));
    fireEvent.change(screen.getByLabelText('¿Cuándo lo viste?'), {
      target: { value: localTime(new Date(Date.now() + offset)) },
    });

    await fillAndSend();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La hora debe ser de las últimas 24 horas.',
    );
    expect(sentReports(api)).toHaveLength(0);
  });

  it('si el producto tiene una sola presentación ya viene elegida', async () => {
    const banana = { ...rice, presentations: rice.presentations.slice(0, 1) };
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: banana } });

    renderReport();

    expect(await screen.findByRole('radio', { name: '500 g' })).toBeChecked();
  });

  it('mientras llega el producto dice «Cargando…»', () => {
    stubPendingApi();

    renderReport();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('si el producto no carga muestra el error y «Reintentar» lo vuelve a pedir', async () => {
    const api = stubApi({
      [`GET /v1/products/${rice.id}`]: [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        { status: 200, body: rice },
      ],
    });
    renderReport();

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
    expect(api.requested).toHaveLength(2);
  });

  it.each([
    [
      'sin tiendas cerca lo dice',
      { status: 200, body: { items: [] } },
      'No hay tiendas registradas cerca de ti.',
    ],
    [
      'si la búsqueda de tiendas falla lo dice',
      { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
      'Ocurrió un error inesperado.',
    ],
  ])('%s', async (_case, nearby, message) => {
    stubApi({ ...productRoute, 'GET /v1/establishments/nearby': nearby });
    stubLocation('allow');
    renderReport();

    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('mientras busca las tiendas cercanas dice «Buscando tiendas…»', async () => {
    stubApi({ ...productRoute, 'GET /v1/establishments/nearby': { status: 200, pending: true } });
    stubLocation('allow');
    renderReport();

    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));

    expect(screen.getByRole('status')).toHaveTextContent('Buscando tiendas…');
  });

  it('si el navegador no tiene ubicación pide activarla, sin romperse', async () => {
    stubApi(productRoute);
    vi.stubGlobal(
      'navigator',
      Object.assign(Object.create(navigator) as Navigator, { geolocation: undefined }),
    );
    renderReport();

    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Activa la ubicación del navegador o busca la tienda por su nombre.',
    );
  });

  // #11: lo que el servidor responde al reportar en línea, explicado en la pantalla.
  it('un reporte repetido dice desde qué hora de Colombia se acepta otro', async () => {
    stubApi({
      ...reportRoutes,
      'POST /v1/reports': {
        status: 409,
        body: {
          code: 'DUPLICATE_REPORT',
          message: 'Ya hay un reporte tuyo de esa presentación en esa tienda.',
          availableFrom: '2026-11-16T15:30:00Z',
        },
      },
    });
    renderReport();

    await fillAndSend();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ya registraste este producto en esta tienda hace poco.');
    expect(alert).toHaveTextContent(/Podrás registrar otro precio desde las 10:30/);
  });

  it.each([
    [700, 'en 12 minutos'],
    [45, 'en 1 minuto'],
  ])(
    'muchos reportes en una hora (Retry-After %i s) dicen cuándo se puede seguir: %s',
    async (seconds, wait) => {
      stubApi({
        ...reportRoutes,
        'POST /v1/reports': {
          status: 429,
          body: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados reportes.' },
          headers: { 'Retry-After': String(seconds) },
        },
      });
      renderReport();

      await fillAndSend();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        `Registraste muchos precios en poco tiempo. Podrás registrar otro ${wait}.`,
      );
    },
  );

  it('una hora que el servidor no acepta pide revisar cuándo se vio', async () => {
    stubApi({
      ...reportRoutes,
      'POST /v1/reports': {
        status: 422,
        body: { code: 'INVALID_OBSERVATION_DATE', message: 'observedAt fuera de rango.' },
      },
    });
    renderReport();

    await fillAndSend();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La hora en que lo viste debe ser de las últimas 24 horas. Revisa «¿Cuándo lo viste?».',
    );
  });

  it('con la cuenta suspendida dice que no puede registrar y lleva a sus aportes', async () => {
    stubApi({
      ...reportRoutes,
      'POST /v1/reports': {
        status: 403,
        body: { code: 'ACCOUNT_SUSPENDED', message: 'La cuenta está suspendida.' },
      },
    });
    renderReport();

    await fillAndSend();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu cuenta está suspendida: por ahora no puedes registrar precios.',
    );
    expect(screen.getByRole('link', { name: 'Ver mis aportes' })).toHaveAttribute(
      'href',
      '/mis-aportes',
    );
  });

  it('si el servidor ya lo tenía (200, reintento con la misma clave) también dice «Recibido»', async () => {
    stubApi({ ...reportRoutes, 'POST /v1/reports': { status: 200, body: receipt } });
    renderReport();

    await fillAndSend();

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
  });

  // B#116: elegir la tienda sin compartir la ubicación (EC-08).
  const searchStore = (text: string) => {
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar tienda por nombre' }), {
      target: { value: text },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar tienda' }));
  };

  it('sin dar la ubicación se busca la tienda por su nombre y se elige', async () => {
    const api = stubApi({
      ...productRoute,
      'GET /v1/establishments': {
        status: 200,
        body: { items: [{ ...donPepe, distanceM: undefined }] },
      },
    });
    renderReport();
    await screen.findByRole('heading', { name: 'Arroz blanco' });

    searchStore('don pepe');

    fireEvent.click(await screen.findByRole('radio', { name: /Tienda Don Pepe/ }));
    expect(screen.getByRole('radio', { name: /Tienda Don Pepe/ })).toBeChecked();
    const asked = api.requested.find(({ pathname }) => pathname === '/v1/establishments');
    expect(asked?.searchParams.get('q')).toBe('don pepe');
  });

  it.each([
    [
      'con menos de 2 letras avisa sin buscar',
      'd',
      'Escribe al menos 2 letras del nombre de la tienda.',
      false,
    ],
    ['sin resultados lo dice', 'zzz', 'No encontramos tiendas con ese nombre.', true],
  ])('la búsqueda de tienda %s', async (_case, text, message, asks) => {
    const api = stubApi({
      ...productRoute,
      'GET /v1/establishments': { status: 200, body: { items: [] } },
    });
    renderReport();
    await screen.findByRole('heading', { name: 'Arroz blanco' });

    searchStore(text);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(api.requested.some(({ pathname }) => pathname === '/v1/establishments')).toBe(asks);
  });

  it('Enter en el buscador de tiendas busca la tienda y no envía el reporte', async () => {
    const api = stubApi({
      ...reportRoutes,
      'GET /v1/establishments': { status: 200, body: { items: [donPepe] } },
    });
    renderReport();
    const box = await screen.findByRole('searchbox', { name: 'Buscar tienda por nombre' });

    fireEvent.change(box, { target: { value: 'don pepe' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(await screen.findByRole('radio', { name: /Tienda Don Pepe/ })).toBeInTheDocument();
    expect(sentReports(api)).toHaveLength(0);
  });

  it('si la búsqueda de tienda por nombre falla muestra el error', async () => {
    stubApi({
      ...productRoute,
      'GET /v1/establishments': {
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
      },
    });
    renderReport();
    await screen.findByRole('heading', { name: 'Arroz blanco' });

    searchStore('don pepe');

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
  });
});
