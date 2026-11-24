import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { seriousViolations } from '../../test/axe';
import { NO_SESSION, sessionAs, stubApi } from '../../test/fakeApi';
import { askLocation } from '../../shared/location';

vi.mock('../stores/StoreMap', () => ({ StoreMap: () => null }));
vi.mock('../../shared/location', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/location')>()),
  askLocation: vi.fn(),
}));
const locate = vi.mocked(askLocation);

const store = {
  id: '1eee2222-3333-4444-8555-666666666666',
  name: 'Tienda La Rosa',
  municipality: 'armenia',
  type: 'barrio',
  lat: 4.53,
  lng: -75.68,
};
const registration = '/comercios/registro';
const claims = '/v1/commerce/claims';
const profile = '/v1/commerce/me';
const session = '/v1/auth/session';
const missing = { status: 404, body: { code: 'NOT_FOUND', message: 'No hay solicitud.' } };
const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Compartir mi ubicación y registrar' }));

function open(path: string) {
  window.history.pushState({}, '', path);
  render(<App />);
}

function responsible() {
  fireEvent.change(screen.getByLabelText('Nombre del responsable'), {
    target: { value: 'Rosa Gómez' },
  });
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '3001234567' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Acepto las condiciones para comercios' }));
}

async function findStore() {
  fireEvent.change(await screen.findByRole('searchbox', { name: 'Buscar tienda por nombre' }), {
    target: { value: 'La Rosa' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar tienda' }));
  fireEvent.click(await screen.findByRole('radio', { name: /Tienda La Rosa/ }));
}

describe('registro de comercios (#165)', () => {
  afterEach(() => {
    locate.mockReset();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('pide entrar y conserva la tienda de origen', async () => {
    stubApi({ [`GET ${session}`]: NO_SESSION });
    open(`${registration}?tienda=${store.id}`);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/entrar');
    });
    expect(new URLSearchParams(window.location.search).get('volver')).toBe(
      `${registration}?tienda=${store.id}`,
    );
  });

  it('enlaza desde Yo al registro', async () => {
    stubApi({
      [`GET ${session}`]: sessionAs('reportante'),
      [`GET /v1/establishments/${store.id}/prices`]: {
        status: 200,
        body: { establishment: store, prices: [] },
      },
      [`GET ${profile}`]: missing,
    });
    open('/yo');
    expect(await screen.findByRole('link', { name: /Registrar mi tienda/ })).toHaveAttribute(
      'href',
      registration,
    );
  });

  it('abre el formulario con la tienda de la ficha preseleccionada', async () => {
    stubApi({
      [`GET ${session}`]: sessionAs('reportante'),
      [`GET /v1/establishments/${store.id}/prices`]: {
        status: 200,
        body: { establishment: store, prices: [] },
      },
      [`GET ${profile}`]: missing,
    });
    open(`/tiendas/${store.id}`);
    fireEvent.click(
      await screen.findByRole('link', { name: '¿Eres el dueño? Registra tu tienda' }),
    );
    expect(await screen.findByRole('radio', { name: /Tienda La Rosa/ })).toBeChecked();
  });

  it('busca sin ubicación, registra sin NIT y espera el cambio de rol', async () => {
    locate.mockResolvedValue({ lat: 4.53, lng: -75.68 });
    let sent = false;
    let checks = 0;
    const { calls } = stubApi({
      [`GET ${session}`]: () => sessionAs(sent && ++checks >= 2 ? 'comercio' : 'reportante'),
      [`GET ${profile}`]: missing,
      'GET /v1/establishments': { status: 200, body: { items: [store] } },
      [`POST ${claims}`]: () => {
        sent = true;
        return { status: 201, body: { establishmentId: store.id, status: 'verificado' } };
      },
    });
    open(registration);
    await findStore();
    responsible();
    expect(locate).not.toHaveBeenCalled();
    submit();
    expect(
      await screen.findByRole('heading', { name: 'Tu tienda quedó verificada' }),
    ).toBeInTheDocument();
    expect(locate).toHaveBeenCalledTimes(1);
    const attempt = calls.find(({ path }) => path === claims);
    expect(attempt?.headers.get('X-CSRF-Token')).toBe('token-1');
    expect(attempt?.body).toBe(
      JSON.stringify({
        establishmentId: store.id,
        responsibleName: 'Rosa Gómez',
        phone: '3001234567',
        acceptedTermsVersion: '2026-11',
        location: { lat: 4.53, lng: -75.68 },
      }),
    );
    await waitFor(() => {
      expect(checks).toBe(2);
    });
    fireEvent.click(screen.getByRole('link', { name: 'Volver a Yo' }));
    expect(await screen.findByText('Comercio', { exact: true })).toBeInTheDocument();
  });

  it('propone una tienda nueva y muestra qué se desbloquea al aprobarla', async () => {
    locate.mockResolvedValue({ lat: 4.53, lng: -75.68 });
    const { calls } = stubApi({
      [`GET ${session}`]: sessionAs('reportante'),
      [`GET ${profile}`]: missing,
      [`POST ${claims}`]: {
        status: 201,
        body: {
          status: 'pre_aprobado',
          establishmentId: store.id,
          unlocks: ['precios_oficiales', 'promociones'],
        },
      },
    });
    open(registration);
    fireEvent.click(await screen.findByRole('button', { name: 'Mi tienda no está en el mapa' }));
    fireEvent.change(screen.getByLabelText('Nombre de la tienda'), {
      target: { value: 'Mi tienda' },
    });
    responsible();
    submit();
    expect(
      await screen.findByRole('heading', { name: 'Tu tienda quedó preaprobada' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Publicar precios oficiales')).toBeInTheDocument();
    expect(screen.getByText('Publicar promociones')).toBeInTheDocument();
    const attempt = calls.find(({ path }) => path === claims);
    expect(attempt?.body).toBe(
      JSON.stringify({
        newEstablishment: { name: 'Mi tienda', type: 'barrio', municipality: 'armenia' },
        responsibleName: 'Rosa Gómez',
        phone: '3001234567',
        acceptedTermsVersion: '2026-11',
        location: { lat: 4.53, lng: -75.68 },
      }),
    );
  });

  it('recupera una solicitud pendiente al volver a entrar', async () => {
    stubApi({
      [`GET ${session}`]: sessionAs('reportante'),
      [`GET ${profile}`]: {
        status: 200,
        body: { status: 'pre_aprobado', establishment: store, unlocks: ['datos_de_la_tienda'] },
      },
    });
    open(registration);
    expect(
      await screen.findByRole('heading', { name: 'Tu tienda quedó preaprobada' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Actualizar los datos de la tienda')).toBeInTheDocument();
  });

  it('no envía el formulario si el navegador niega la ubicación', async () => {
    locate.mockRejectedValue(new Error('Ubicación denegada'));
    const { calls } = stubApi({
      [`GET ${session}`]: sessionAs('reportante'),
      [`GET ${profile}`]: missing,
      'GET /v1/establishments': { status: 200, body: { items: [store] } },
    });
    open(registration);
    await findStore();
    responsible();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/sin ubicación/i);
    expect(calls.some(({ path }) => path === claims)).toBe(false);
  });

  it('explica una ubicación fuera del radio que valida el backend', async () => {
    locate.mockResolvedValue({ lat: 4.53, lng: -75.68 });
    stubApi({
      [`GET ${session}`]: sessionAs('reportante'),
      [`GET ${profile}`]: missing,
      'GET /v1/establishments': { status: 200, body: { items: [store] } },
      [`POST ${claims}`]: {
        status: 422,
        body: { code: 'NOT_AT_ESTABLISHMENT', message: 'Fuera.' },
      },
    });
    open(registration);
    await findStore();
    responsible();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/50 m/);
  });

  it('retira el aviso de error apenas la persona corrige el campo', async () => {
    stubApi({
      [`GET ${session}`]: sessionAs('reportante'),
      [`GET ${profile}`]: missing,
      'GET /v1/establishments': { status: 200, body: { items: [store] } },
    });
    open(registration);
    await findStore();
    responsible();
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '12345' } });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/celular de 10 dígitos/);

    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '3001234567' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('dice que espera la ubicación mientras el navegador la obtiene', async () => {
    locate.mockReturnValue(new Promise(() => undefined));
    stubApi({
      [`GET ${session}`]: sessionAs('reportante'),
      [`GET ${profile}`]: missing,
      'GET /v1/establishments': { status: 200, body: { items: [store] } },
    });
    open(registration);
    await findStore();
    responsible();
    submit();
    expect(await screen.findByRole('button', { name: 'Obteniendo tu ubicación…' })).toBeDisabled();
  });

  it('pide aceptar las condiciones antes de compartir la ubicación', async () => {
    const { calls } = stubApi({
      [`GET ${session}`]: sessionAs('reportante'),
      [`GET ${profile}`]: missing,
      'GET /v1/establishments': { status: 200, body: { items: [store] } },
    });
    open(registration);
    await findStore();
    responsible();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Acepto las condiciones para comercios' }),
    );
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/acepta las condiciones/i);
    expect(locate).not.toHaveBeenCalled();
    expect(calls.some(({ path }) => path === claims)).toBe(false);
  });

  it('actualiza la sesión cuando una tienda preaprobada pasa a verificada', async () => {
    let approved = false;
    stubApi({
      [`GET ${session}`]: () => sessionAs(approved ? 'comercio' : 'reportante'),
      [`GET ${profile}`]: () => ({
        status: 200,
        body: { status: approved ? 'verificado' : 'pre_aprobado', establishment: store },
      }),
    });
    open(registration);
    const refresh = await screen.findByRole('button', { name: 'Consultar estado' });
    approved = true;
    fireEvent.click(refresh);
    expect(
      await screen.findByRole('heading', { name: 'Tu tienda quedó verificada' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Volver a Yo' }));
    expect(await screen.findByText('Comercio', { exact: true })).toBeInTheDocument();
  });

  it('el formulario no tiene violaciones graves de axe', async () => {
    stubApi({ [`GET ${session}`]: sessionAs('reportante'), [`GET ${profile}`]: missing });
    open(registration);
    await screen.findByRole('heading', { name: 'Registrar mi tienda' });
    expect(await seriousViolations(screen.getByRole('main'))).toEqual([]);
  });

  it('ofrece reenviar el enlace si el correo no está verificado', async () => {
    stubApi({ [`GET ${session}`]: sessionAs('reportante', undefined, false) });
    open(registration);
    expect(
      (await screen.findAllByRole('button', { name: 'Enviarme otro enlace' }))[0],
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Compartir mi ubicación y registrar' }),
    ).not.toBeInTheDocument();
  });
});
