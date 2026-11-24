import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi, stubPendingApi } from '../../test/fakeApi';
import { stubLocation, stubNoGeolocation } from '../../test/location';
import { openReportQueue } from '../../pwa/reportQueue';
import { ReportQueueProvider } from '../../pwa/ReportQueueProvider';
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
    <ReportQueueProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/registrar" element={<ReportPrice />} />
        </Routes>
      </MemoryRouter>
    </ReportQueueProvider>,
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

  // #79 y #28 (EC-01): solo en el modo prueba de usabilidad; se quita al cerrar la #28.
  it('en el modo prueba de usabilidad muestra el cronómetro y cuánto tardó el registro', async () => {
    localStorage.setItem('valora:modo-prueba', '1');
    stubApi(reportRoutes);
    renderReport();

    expect(await screen.findByRole('timer', { name: 'Cronómetro' })).toHaveTextContent(/^0:0\d$/);
    await fillAndSend();

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
    expect(screen.getByText(/^Registrado en \d+ s\.$/)).toBeInTheDocument();
  });

  it('sin el modo prueba no hay cronómetro', async () => {
    stubApi(reportRoutes);
    renderReport();

    await screen.findByRole('heading', { name: 'Arroz blanco' });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
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
    [
      'un precio sin centavos',
      { size: true, store: true, price: '2,5' },
      'Escribe el precio en pesos enteros, sin centavos.',
    ],
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

  it('si el servidor no responde, el reporte queda guardado en el teléfono y se enviará solo', async () => {
    stubApi({
      ...reportRoutes,
      'POST /v1/reports': {
        status: 503,
        body: { code: 'REQUEST_ERROR', message: 'Servicio no disponible.' },
      },
    });
    renderReport();

    await fillAndSend();

    expect(
      await screen.findByRole('heading', { name: 'Guardado en tu teléfono' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Se enviará solo cuando haya conexión; al enviarse cuenta en la comparación.',
      ),
    ).toBeInTheDocument();
    const [saved] = await (await openReportQueue()).list();
    expect(saved?.status).toBe('pendiente');
  });

  it('el reporte se guarda en el teléfono antes de intentar enviarlo', async () => {
    const api = stubApi({ ...reportRoutes, 'POST /v1/reports': { status: 201, pending: true } });
    renderReport();

    await fillAndSend();
    await screen.findByRole('button', { name: 'Enviando…' });
    // El envío queda colgado: se espera a que salga para que no llegue a la prueba siguiente.
    await vi.waitFor(() => {
      expect(sentReports(api)).toHaveLength(1);
    });

    const [saved] = await (await openReportQueue()).list();
    expect(saved).toMatchObject({
      status: 'pendiente',
      body: { establishmentId: donPepe.id, priceCop: 2500 },
      label: { product: 'Arroz blanco · 500 g', store: 'Tienda Don Pepe' },
    });
  });

  it('si el servidor lo rechaza y se cambia el reporte, lo envía con una clave nueva', async () => {
    const api = stubApi({
      ...reportRoutes,
      'POST /v1/reports': [
        {
          status: 409,
          body: {
            code: 'DUPLICATE_REPORT',
            message: 'Repetido.',
            availableFrom: '2026-11-16T15:30:00Z',
          },
        },
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
    const api = stubApi({ ...reportRoutes, 'POST /v1/reports': { status: 201, pending: true } });
    renderReport();

    await fillAndSend();

    expect(await screen.findByRole('button', { name: 'Enviando…' })).toBeDisabled();
    // El envío queda colgado: se espera a que salga para que no llegue a la prueba siguiente.
    await vi.waitFor(() => {
      expect(sentReports(api)).toHaveLength(1);
    });
  });

  it('sin producto pregunta qué precio viste y cada resultado vuelve al registro', async () => {
    stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice] } } });
    renderReport('/registrar');

    expect(screen.getByRole('heading', { name: '¿Qué precio viste?' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Buscar producto' }), {
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

    // Con la tienda ya elegida, el bloque es una fila: «Tienda X · Cambiar».
    const row = await screen.findByRole('group', { name: 'Tienda' });
    expect(row).toHaveTextContent('Tienda Don Pepe');
    expect(within(row).getByRole('button', { name: /^Cambiar/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Tienda Don Pepe/ })).toBeNull();
  });

  it('la tienda recordada no muestra la distancia de la vez anterior', async () => {
    stubApi(reportRoutes);
    const first = renderReport();
    await fillAndSend();
    await screen.findByRole('heading', { name: 'Recibido' });
    first.unmount();

    renderReport();

    const stores = await screen.findByRole('group', { name: 'Tienda' });
    expect(stores).not.toHaveTextContent('350 m');
  });

  describe('el bloque «Tienda» elegido es una sola fila', () => {
    const remembered = () => {
      localStorage.setItem('valora:ultima-tienda', JSON.stringify(donPepe));
      stubApi({
        ...productRoute,
        'GET /v1/establishments': { status: 200, body: { items: [donPepe, otherStore] } },
      });
    };
    const otherStore = {
      ...donPepe,
      id: '6e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d1e',
      name: 'D1 Bolívar',
    };

    it('«Cambiar» reabre el buscador, con el foco en su campo y la tienda actual elegida', async () => {
      remembered();
      renderReport();
      fireEvent.click(await screen.findByRole('button', { name: /^Cambiar/ }));

      expect(screen.getByRole('searchbox', { name: 'Buscar tienda por nombre' })).toHaveFocus();
      expect(screen.getByRole('radio', { name: /Tienda Don Pepe/ })).toBeChecked();
      expect(screen.queryByRole('group', { name: 'Tienda' })).toBeNull();
    });

    it('elegir otra tienda vuelve a la fila y devuelve el foco a «Cambiar»', async () => {
      remembered();
      renderReport();
      fireEvent.click(await screen.findByRole('button', { name: /^Cambiar/ }));
      searchStore('bol');

      fireEvent.click(await screen.findByRole('radio', { name: /D1 Bolívar/ }));

      const row = screen.getByRole('group', { name: 'Tienda' });
      expect(row).toHaveTextContent('D1 Bolívar');
      expect(within(row).getByRole('button', { name: /^Cambiar/ })).toHaveFocus();
    });

    it('«Seguir con» la tienda actual cierra el buscador sin cambiar nada', async () => {
      remembered();
      renderReport();
      fireEvent.click(await screen.findByRole('button', { name: /^Cambiar/ }));

      fireEvent.click(screen.getByRole('button', { name: 'Seguir con «Tienda Don Pepe»' }));

      expect(screen.getByRole('group', { name: 'Tienda' })).toHaveTextContent('Tienda Don Pepe');
      expect(screen.getByRole('button', { name: /^Cambiar/ })).toHaveFocus();
    });

    it('sin tienda elegida se ve el buscador completo, sin «Seguir con»', async () => {
      stubApi(productRoute);
      renderReport();

      expect(await screen.findByRole('radiogroup', { name: 'Tienda' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Seguir con/ })).toBeNull();
    });
  });

  it('la nota del precio es una línea y el formato va plegado', async () => {
    stubApi(productRoute);
    renderReport();

    await screen.findByRole('heading', { name: 'Arroz blanco' });
    expect(screen.getByText('Es el precio de la presentación que elijas.')).toHaveAttribute(
      'id',
      'ayuda-precio',
    );
    const help = screen.getByText('¿Cómo escribirlo?').closest('details');
    expect(help).not.toHaveAttribute('open');
    expect(help).toHaveTextContent('Puedes escribirlo como 4600, 4.600 o $4.600.');
  });

  it('«Enviar» va en la barra de acción del formulario', async () => {
    stubApi(productRoute);
    renderReport();

    const send = await screen.findByRole('button', { name: 'Enviar' });
    expect(send.closest('.report-bar')).not.toBeNull();
    expect(send.closest('form')).not.toBeNull();
  });

  describe('tienda preseleccionada con ?tienda=', () => {
    const pepePrices = {
      [`GET /v1/establishments/${donPepe.id}/prices`]: {
        status: 200,
        body: { establishment: donPepe, prices: [] },
      },
    };

    it('deja elegida la tienda de la dirección, junto con el producto', async () => {
      stubApi({ ...productRoute, ...pepePrices });
      renderReport(`/registrar?producto=${rice.id}&tienda=${donPepe.id}`);

      expect(await screen.findByRole('group', { name: 'Tienda' })).toHaveTextContent(
        'Tienda Don Pepe',
      );
    });

    it('si no es un UUID se ignora sin llamar a la API ni romper la pantalla', async () => {
      const api = stubApi(productRoute);
      renderReport(`/registrar?producto=${rice.id}&tienda=otra`);

      expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: /Tienda/ })).toBeNull();
      expect(api.calls.some(({ path }) => path.includes('/establishments/'))).toBe(false);
    });

    it('si la tienda no existe se ignora y queda la última recordada', async () => {
      localStorage.setItem('valora:ultima-tienda', JSON.stringify(donPepe));
      stubApi(productRoute);
      renderReport(`/registrar?producto=${rice.id}&tienda=11111111-2222-4333-8444-555555555555`);

      expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Tienda' })).toHaveTextContent('Tienda Don Pepe');
    });

    it('sin producto, la tienda sigue en los enlaces de cada resultado reciente', () => {
      localStorage.setItem(
        'valora:ultimos-productos',
        JSON.stringify([{ id: rice.id, name: 'Arroz blanco' }]),
      );
      stubApi({});
      renderReport(`/registrar?tienda=${donPepe.id}`);

      expect(screen.getByRole('link', { name: 'Arroz blanco' })).toHaveAttribute(
        'href',
        `/registrar?producto=${rice.id}&tienda=${donPepe.id}`,
      );
    });
  });

  it('después de «Recibido» se puede registrar otro producto en la misma tienda', async () => {
    stubApi(reportRoutes);
    renderReport();

    await fillAndSend();

    expect(
      await screen.findByRole('link', { name: 'Registrar otro en esta tienda' }),
    ).toHaveAttribute('href', '/registrar');
  });

  it('«Lo vi otro día» permite elegir la hora en que se vio el precio', async () => {
    const api = stubApi(reportRoutes);
    renderReport();
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    fireEvent.click(await screen.findByRole('button', { name: 'Lo vi otro día' }));
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
    fireEvent.click(await screen.findByRole('button', { name: 'Lo vi otro día' }));
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
    expect(
      api.requested.filter(({ pathname }) => pathname === `/v1/products/${rice.id}`),
    ).toHaveLength(2);
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
    stubNoGeolocation();
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

    const pepe = await screen.findByRole('radio', { name: /Tienda Don Pepe/ });
    expect(screen.getByRole('link', { name: '¿No está la tienda? Sugiérela' })).toHaveAttribute(
      'href',
      '/proponer/tienda',
    );
    fireEvent.click(pepe);
    expect(screen.getByRole('group', { name: 'Tienda' })).toHaveTextContent('Tienda Don Pepe');
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

describe('registrar un precio: mejoras de flujo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('«Recibido» ofrece ver la comparación del producto y los aportes, y dice qué pasa', async () => {
    stubApi(reportRoutes);
    renderReport();

    await fillAndSend();

    expect(
      await screen.findByRole('link', { name: 'Ver la comparación de Arroz blanco' }),
    ).toHaveAttribute('href', `/productos/${rice.id}`);
    expect(screen.getByRole('link', { name: 'Ver mis aportes' })).toHaveAttribute(
      'href',
      '/mis-aportes',
    );
    expect(screen.getByText(/Ya cuenta en la comparación/)).toBeInTheDocument();
  });

  it('«$1.490» y «1490,00» se aceptan y se envía el entero', async () => {
    const api = stubApi(reportRoutes);
    renderReport();

    await fillAndSend('$1.490,00');

    await screen.findByRole('heading', { name: 'Recibido' });
    expect(JSON.parse(sentReports(api)[0]?.body ?? '{}')).toMatchObject({ priceCop: 1490 });
  });

  it('el campo del precio dice de qué presentación es y marca el error con el foco', async () => {
    stubApi(reportRoutes);
    renderReport();
    fireEvent.click(await screen.findByRole('radio', { name: '500 g' }));
    stubLocation('allow');
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Tienda Don Pepe/ }));
    const price = screen.getByLabelText('Precio en pesos');
    expect(price).toHaveAccessibleDescription(/Es el precio de 500 g/);

    fireEvent.change(price, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(price).toHaveAttribute('aria-invalid', 'true');
    expect(price).toHaveAccessibleDescription(/Escribe solo números/);
    expect(price).toHaveFocus();

    fireEvent.change(price, { target: { value: '2500' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('antes de pedir la ubicación dice para qué se usa y que no se publica', async () => {
    stubApi(productRoute);
    renderReport();

    expect(
      await screen.findByRole('button', { name: 'Usar mi ubicación' }),
    ).toHaveAccessibleDescription(/no se guarda ni se publica/);
  });

  it('con la cuenta sin verificar dice que verifique el correo, no «sin conexión», y no lo guarda', async () => {
    const api = stubApi({
      ...reportRoutes,
      'POST /v1/reports': {
        status: 403,
        body: { code: 'EMAIL_NOT_VERIFIED', message: 'Verifica tu correo.' },
      },
      'POST /v1/auth/resend-verification': { status: 202 },
    });
    renderReport();

    await fillAndSend();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Verifica tu correo para registrar precios.');
    expect(screen.queryByText('Guardado en tu teléfono')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme otro enlace' }));
    expect(await screen.findByText(/revisa tu bandeja/)).toBeInTheDocument();
    expect(api.calls.filter(({ path }) => path === '/v1/auth/resend-verification')).toHaveLength(1);
    // Un segundo envío con el mismo reporte no queda pendiente en el teléfono.
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
  });

  it('sin producto sugiere los últimos que se registraron', async () => {
    localStorage.setItem(
      'valora:ultimos-productos',
      JSON.stringify([{ id: rice.id, name: 'Arroz blanco' }]),
    );
    stubApi({});
    renderReport('/registrar');

    expect(await screen.findByRole('link', { name: 'Arroz blanco' })).toHaveAttribute(
      'href',
      `/registrar?producto=${rice.id}`,
    );
  });

  it('después de registrar, el producto queda entre los últimos', async () => {
    stubApi(reportRoutes);
    renderReport();

    await fillAndSend();
    await screen.findByRole('heading', { name: 'Recibido' });

    expect(localStorage.getItem('valora:ultimos-productos')).toContain('Arroz blanco');
  });
});

// EC-03: antes de enviar, un precio muy lejos de lo que ya se ve pide confirmación.
describe('registrar un precio: precio atípico', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  const kgId = rice.presentations[1]?.id;
  const offer = (priceCop: number, presentationId = kgId) => ({
    establishment: donPepe,
    reportId: crypto.randomUUID(),
    presentationId,
    priceCop,
    unitPrice: { valueCop: priceCop / 10, per: '100g' },
    source: 'comunidad',
    freshness: 'vigente',
    reliability: 'alta',
    isCheapest: false,
    confirmations: 1,
    observedAt: '2026-11-16T10:00:00Z',
  });
  const comparisonRoute = (prices: number[]) => ({
    [`GET /v1/products/${rice.id}/comparison`]: {
      status: 200,
      body: { results: prices.map((price) => offer(price)) },
    },
  });
  const comparisonAsked = (api: ReturnType<typeof stubApi>) =>
    api.requested.filter(({ pathname }) => pathname.endsWith('/comparison'));
  const seen = [19_900, 24_000, 28_000];

  // Igual que fillAndSend, pero con la presentación de 1 kg y esperando la referencia.
  const sendKg = async (api: ReturnType<typeof stubApi>, price: string) => {
    fireEvent.click(await screen.findByRole('radio', { name: '1 kg' }));
    await waitFor(() => {
      expect(comparisonAsked(api)).toHaveLength(1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    stubLocation('allow');
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Tienda Don Pepe/ }));
    fireEvent.change(screen.getByLabelText('Precio en pesos'), { target: { value: price } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  };

  it('con referencia, un precio muy bajo no se envía: pregunta con las cifras, enfoca el bloque y no pide la ubicación', async () => {
    const api = stubApi({ ...reportRoutes, ...comparisonRoute(seen) });
    renderReport();

    await sendKg(api, '2400');

    const block = await screen.findByRole('alertdialog');
    expect(block).toHaveTextContent(
      'Lo más barato que vemos para esta presentación es $19.900 y lo más caro $28.000. Tu precio es $2.400. ¿Está bien?',
    );
    expect(block).toHaveTextContent('Un moderador puede revisarlo antes de mostrarlo.');
    expect(block).toHaveFocus();
    expect(block).toHaveAttribute('aria-live');
    expect(sentReports(api)).toHaveLength(0);
    const [asked] = comparisonAsked(api);
    expect(asked?.searchParams.get('municipality')).toBe('armenia');
    expect(asked?.searchParams.has('lat')).toBe(false);
    expect(asked?.searchParams.has('lng')).toBe(false);
  });

  it('«Corregir el precio» cierra el bloque y vuelve al campo con su valor', async () => {
    const api = stubApi({ ...reportRoutes, ...comparisonRoute(seen) });
    renderReport();
    await sendKg(api, '2400');

    fireEvent.click(await screen.findByRole('button', { name: 'Corregir el precio' }));

    const field = screen.getByLabelText('Precio en pesos');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(field).toHaveValue('2400');
    expect(sentReports(api)).toHaveLength(0);
  });

  it('Escape también corrige', async () => {
    const api = stubApi({ ...reportRoutes, ...comparisonRoute(seen) });
    renderReport();
    await sendKg(api, '2400');

    fireEvent.keyDown(await screen.findByRole('alertdialog'), { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Precio en pesos')).toHaveFocus();
  });

  it('«Sí, ese es el precio» envía normalmente, con el mismo cuerpo del contrato', async () => {
    const api = stubApi({ ...reportRoutes, ...comparisonRoute(seen) });
    renderReport();
    await sendKg(api, '2400');

    fireEvent.click(await screen.findByRole('button', { name: 'Sí, ese es el precio' }));

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
    const body = JSON.parse(sentReports(api)[0]?.body ?? '{}') as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'establishmentId',
      'observedAt',
      'presentationId',
      'priceCop',
      'priceType',
    ]);
    expect(body).toMatchObject({ priceCop: 2400 });
  });

  it('sugiere el precio con los ceros que faltan y «Sí, escribir» lo pone en el campo', async () => {
    const api = stubApi({ ...reportRoutes, ...comparisonRoute(seen) });
    renderReport();
    await sendKg(api, '2400');

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('¿Querías escribir $24.000?');
    fireEvent.click(screen.getByRole('button', { name: 'Sí, escribir $24.000' }));

    expect(screen.getByLabelText('Precio en pesos')).toHaveValue('24000');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByRole('heading', { name: 'Recibido' });
    expect(JSON.parse(sentReports(api)[0]?.body ?? '{}')).toMatchObject({ priceCop: 24_000 });
  });

  it('sin sugerencia evidente no la ofrece', async () => {
    const api = stubApi({ ...reportRoutes, ...comparisonRoute(seen) });
    renderReport();
    await sendKg(api, '700');

    expect(await screen.findByRole('alertdialog')).not.toHaveTextContent('¿Querías escribir');
  });

  it.each([
    ['bajo 40 % de la mediana', '399'],
    ['sobre 250 % de la mediana', '2501'],
  ])('con mediana de $1.000, %s pide confirmación y no envía', async (_name, price) => {
    const api = stubApi({ ...reportRoutes, ...comparisonRoute([900, 1000, 1100]) });
    renderReport();

    await sendKg(api, price);

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(sentReports(api)).toHaveLength(0);
  });

  it.each([
    ['justo 40 % de la mediana', '400'],
    ['justo 250 % de la mediana', '2500'],
  ])('con mediana de $1.000, %s envía sin preguntar', async (_name, price) => {
    const api = stubApi({ ...reportRoutes, ...comparisonRoute([900, 1000, 1100]) });
    renderReport();

    await sendKg(api, price);

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
  });

  it('menos de $100 no se envía ni deja confirmar: pregunta si faltan ceros', async () => {
    const api = stubApi({ ...reportRoutes, ...comparisonRoute(seen) });
    renderReport();

    await sendKg(api, '99');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Revisa el precio: ¿le faltan ceros?',
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Precio en pesos')).toHaveFocus();
    expect(sentReports(api)).toHaveLength(0);
  });

  it('$100 justo no es imposible', async () => {
    const api = stubApi(reportRoutes);
    renderReport();

    await fillAndSend('100');

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
    expect(sentReports(api)).toHaveLength(1);
  });

  it('con un solo precio vigente no hay referencia y no pide confirmación', async () => {
    const api = stubApi({ ...reportRoutes, ...comparisonRoute([2400]) });
    renderReport();

    await sendKg(api, '12000');

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
  });

  it('solo cuentan los precios de esa presentación', async () => {
    const api = stubApi({
      ...reportRoutes,
      [`GET /v1/products/${rice.id}/comparison`]: {
        status: 200,
        body: {
          results: [
            offer(900, rice.presentations[0]?.id),
            offer(1000, rice.presentations[0]?.id),
            offer(2400),
          ],
        },
      },
    });
    renderReport();

    await sendKg(api, '12000');

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
  });

  it('si la consulta de la referencia falla, el formulario sigue y envía sin pedir confirmación', async () => {
    const api = stubApi({
      ...reportRoutes,
      [`GET /v1/products/${rice.id}/comparison`]: {
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
      },
    });
    renderReport();

    await sendKg(api, '12000');

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
  });

  it('un precio atípico confirmado sin conexión se guarda en la cola', async () => {
    const api = stubApi({
      ...reportRoutes,
      ...comparisonRoute(seen),
      'POST /v1/reports': {
        status: 503,
        body: { code: 'REQUEST_ERROR', message: 'Servicio no disponible.' },
      },
    });
    renderReport();
    await sendKg(api, '2400');

    fireEvent.click(await screen.findByRole('button', { name: 'Sí, ese es el precio' }));

    expect(
      await screen.findByRole('heading', { name: 'Guardado en tu teléfono' }),
    ).toBeInTheDocument();
  });
});
