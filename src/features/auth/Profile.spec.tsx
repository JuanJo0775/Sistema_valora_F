import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, sessionAs, stubApi, stubPendingApi } from '../../test/fakeApi';
import { planDraft } from '../../test/planFixtures';
import { type Avisos, AvisosContext } from '../avisos/avisosContext';
import { savePlan, toSavedPlan } from '../plan/savedPlan';
import { Profile } from './Profile';
import { SessionProvider } from './SessionProvider';

const renderProfile = () =>
  render(
    <SessionProvider>
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    </SessionProvider>,
  );

describe('pestaña Yo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('siempre ofrece la fila «Instalar la app», con o sin sesión', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });

    renderProfile();

    expect(await screen.findByRole('button', { name: /Instalar la app/ })).toBeInTheDocument();
  });

  it.each([
    ['sin sesión', NO_SESSION],
    ['con sesión', sessionAs('reportante')],
  ])('%s, con listas guardadas ofrece el atajo a Guardadas con la cantidad', async (_, reply) => {
    stubApi({
      'GET /v1/auth/session': reply,
      'GET /v1/me/reports': { status: 200, body: { items: [] } },
    });
    savePlan(toSavedPlan(planDraft(), new Date('2026-11-19T12:00:00Z')));
    savePlan(toSavedPlan(planDraft(), new Date('2026-11-20T12:00:00Z')));

    renderProfile();

    const link = await screen.findByRole('link', { name: /Mis listas guardadas \(2\)/ });
    expect(link).toHaveAttribute('href', '/canasta?tab=guardadas');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('sin listas guardadas no muestra el atajo', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });

    renderProfile();

    await screen.findByRole('link', { name: 'Iniciar sesión' });
    expect(screen.queryByRole('link', { name: /Mis listas guardadas/ })).not.toBeInTheDocument();
  });

  it('sin sesión invita a iniciar sesión o a crear una cuenta', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });

    renderProfile();

    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/entrar',
    );
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/crear-cuenta',
    );
  });

  it('con sesión saluda y dice con qué rol entraste', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'GET /v1/me/reports': { status: 200, body: { items: [] } },
    });

    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Hola' })).toBeInTheDocument();
    expect(screen.getByText('Reportante')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
  });

  it('saluda por el nombre cuando la cuenta lo tiene', async () => {
    stubApi({
      'GET /v1/auth/session': {
        status: 200,
        body: { role: 'reportante', csrfToken: 'token-1', displayName: 'Sara' },
      },
      'GET /v1/me/reports': { status: 200, body: { items: [] } },
    });

    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Hola, Sara' })).toBeInTheDocument();
  });

  it('con la cuenta suspendida dice hasta cuándo y qué puede hacer', async () => {
    stubApi({
      'GET /v1/auth/session': {
        status: 200,
        body: { role: 'reportante', csrfToken: 'token-1', suspendedUntil: '2026-11-20T17:00:00Z' },
      },
    });

    renderProfile();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu cuenta está suspendida hasta el 20 de noviembre de 2026. Mientras tanto puedes ver el estado de tus aportes y apelar.',
    );
  });

  it('cerrar sesión la termina en el servidor y vuelve a invitar a entrar', async () => {
    const api = stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/auth/logout': { status: 204 },
    });
    renderProfile();

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(
      api.calls.some(({ method, path }) => method === 'POST' && path === '/v1/auth/logout'),
    ).toBe(true);
  });

  it('mientras pregunta por la sesión dice «Cargando…»', () => {
    stubPendingApi();

    renderProfile();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
  });

  it('si cerrar sesión falla lo dice y la sesión sigue abierta', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/auth/logout': {
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
      },
    });
    renderProfile();

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    expect(screen.getByRole('heading', { name: 'Hola' })).toBeInTheDocument();
  });

  it('sin red no da la sesión por cerrada: muestra el error y «Reintentar» vuelve a preguntar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    renderProfile();

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión con Valora');
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Hola' })).toBeInTheDocument();
  });

  it.each([
    ['reportante', 'Mis aportes', '/mis-aportes'],
    ['moderador', 'Moderación', '/moderacion'],
  ])('un %s encuentra en Yo su fila «%s»', async (role, name, href) => {
    stubApi({ 'GET /v1/auth/session': { status: 200, body: { role, csrfToken: 'token-1' } } });

    renderProfile();

    expect(await screen.findByRole('link', { name: new RegExp(name) })).toHaveAttribute(
      'href',
      href,
    );
  });

  it('con sesión agrupa filas navegables: actividad, preferencias, privacidad y cuenta', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });

    renderProfile();

    const titles = (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent);
    expect(titles).toEqual(['Mi actividad', 'Preferencias', 'Privacidad', 'Cuenta']);
    expect(screen.getByRole('link', { name: /Ajustes/ })).toHaveAttribute('href', '/yo/ajustes');
    expect(screen.getByRole('link', { name: /Política de datos y cookies/ })).toHaveAttribute(
      'href',
      '/privacidad',
    );
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    // El resumen es corto: los ajustes viven en su subpantalla.
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('sin sesión deja Ajustes y la política de datos, que no piden cuenta', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });

    renderProfile();

    expect(await screen.findByRole('link', { name: /Ajustes/ })).toHaveAttribute(
      'href',
      '/yo/ajustes',
    );
    expect(screen.getByRole('link', { name: /Política de datos y cookies/ })).toHaveAttribute(
      'href',
      '/privacidad',
    );
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });
});

// ADR-043: «Yo» dice cuántos casos o avisos tiene quien modera o tiene una tienda.
describe('pestaña Yo con avisos pendientes (ADR-043)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderWith = (role: string, avisos: Avisos) => {
    stubApi({ 'GET /v1/auth/session': sessionAs(role) });
    render(
      <SessionProvider>
        <MemoryRouter>
          <AvisosContext.Provider value={avisos}>
            <Profile />
          </AvisosContext.Provider>
        </MemoryRouter>
      </SessionProvider>,
    );
  };

  it('la fila Moderación dice cuántos casos esperan decisión', async () => {
    renderWith('moderador', {
      kind: 'moderador',
      counts: { precios: 2, tiendas: 0, productos: 1, comercios: 0 },
    });

    expect(await screen.findByRole('link', { name: /Moderación/ })).toHaveTextContent(
      'Tienes 3 casos por revisar',
    );
  });

  it('sin casos, la fila Moderación conserva su texto de siempre', async () => {
    renderWith('moderador', {
      kind: 'moderador',
      counts: { precios: 0, tiendas: 0, productos: 0, comercios: 0 },
    });

    expect(await screen.findByRole('link', { name: /Moderación/ })).toHaveTextContent(
      'Revisa los reportes pendientes',
    );
  });

  it('la fila Mi tienda dice cuántos avisos tiene el comercio', async () => {
    renderWith('comercio', {
      kind: 'comercio',
      alerts: [
        {
          kind: 'vence_pronto',
          presentationId: 'a1b2c3d4-0000-4000-8000-000000000001',
          productName: 'Arroz Diana · 500 g',
          message: 'Tu precio oficial de Arroz Diana · 500 g vence mañana: reconfírmalo.',
        },
      ],
    });

    expect(await screen.findByRole('link', { name: /Mi tienda/ })).toHaveTextContent(
      'Tienes 1 aviso nuevo',
    );
  });
});

// RF-020: los avisos push se activan en Ajustes, no en «Yo».
describe('pestaña Yo y los avisos push (RF-020)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['moderador', 'comercio'] as const)(
    'el rol %s no ve la activación de avisos en «Yo»: está en Ajustes',
    async (role) => {
      const { requested } = stubApi({
        'GET /v1/auth/session': sessionAs(role),
        'GET /v1/notifications/vapid-public-key': { status: 200, body: { publicKey: 'AQID' } },
      });

      renderProfile();

      expect(await screen.findByRole('heading', { name: /Hola/ })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Avisos en este dispositivo' })).toBeNull();
      // Ni siquiera se consulta si el servidor tiene los avisos: esa pantalla vive en Ajustes.
      expect(requested.map(({ pathname }) => pathname)).not.toContain(
        '/v1/notifications/vapid-public-key',
      );
    },
  );
});
