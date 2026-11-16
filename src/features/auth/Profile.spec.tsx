import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { Profile } from './Profile';
import { SessionProvider } from './SessionProvider';

const unauthorized = {
  status: 401,
  body: { code: 'UNAUTHORIZED', message: 'Se requiere sesión.' },
};

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
  });

  it('sin sesión invita a iniciar sesión o a crear una cuenta', async () => {
    stubApi({ 'GET /v1/auth/session': unauthorized });

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

  it('con sesión dice con qué rol entraste', async () => {
    stubApi({
      'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
    });

    renderProfile();

    expect(await screen.findByText('Entraste como reportante.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
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
      'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
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
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    renderProfile();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
  });

  it('si cerrar sesión falla lo dice y la sesión sigue abierta', async () => {
    stubApi({
      'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
      'POST /v1/auth/logout': {
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
      },
    });
    renderProfile();

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    expect(screen.getByText('Entraste como reportante.')).toBeInTheDocument();
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
      'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Entraste como reportante.')).toBeInTheDocument();
  });
});
