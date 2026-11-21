import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, stubApi } from '../../test/fakeApi';
import { POLICY_VERSION } from '../legal/policy';
import { SessionProvider } from './SessionProvider';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';
import { resetProviders, useProviders } from './useProviders';

const PROVIDERS = (google: boolean) => ({ status: 200, body: { google } });

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
};

const renderAt = (path: string) =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path="/entrar" element={<SignIn />} />
          <Route path="/crear-cuenta" element={<SignUp />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

const stubGoogle = (providers: { status: number; body?: unknown }) =>
  stubApi({ 'GET /v1/auth/session': NO_SESSION, 'GET /v1/auth/providers': providers });

describe('useProviders', () => {
  beforeEach(resetProviders);
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con google activo responde true, y consulta una sola vez', async () => {
    const api = stubGoogle(PROVIDERS(true));
    const first = renderHook(() => useProviders());
    await waitFor(() => {
      expect(first.result.current.google).toBe(true);
    });
    const second = renderHook(() => useProviders());
    await waitFor(() => {
      expect(second.result.current.google).toBe(true);
    });
    expect(api.requested.filter(({ pathname }) => pathname === '/v1/auth/providers')).toHaveLength(
      1,
    );
  });

  it('con google apagado responde false', async () => {
    const api = stubGoogle(PROVIDERS(false));
    const { result } = renderHook(() => useProviders());
    await waitFor(() => {
      expect(api.requested).toHaveLength(1);
    });
    expect(result.current.google).toBe(false);
  });

  it('si la consulta falla responde false', async () => {
    const api = stubGoogle({ status: 500, body: { code: 'INTERNAL', message: 'x' } });
    const { result } = renderHook(() => useProviders());
    await waitFor(() => {
      expect(api.requested).toHaveLength(1);
    });
    expect(result.current.google).toBe(false);
  });
});

describe('Continuar con Google', () => {
  beforeEach(resetProviders);
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('en /entrar es un enlace a /v1/auth/google/start con la política y a dónde volver', async () => {
    stubGoogle(PROVIDERS(true));
    renderAt('/entrar?volver=/yo/ajustes');

    const link = await screen.findByRole('link', { name: 'Continuar con Google' });
    const url = new URL(link.getAttribute('href') ?? '', 'http://valora.test');
    expect(url.pathname).toBe('/v1/auth/google/start');
    expect(url.searchParams.get('acceptPolicy')).toBe(POLICY_VERSION);
    expect(url.searchParams.get('returnTo')).toBe('/yo/ajustes');
  });

  it('una ruta de otro sitio no sale como returnTo', async () => {
    stubGoogle(PROVIDERS(true));
    renderAt('/entrar?volver=//otro.sitio');

    const link = await screen.findByRole('link', { name: 'Continuar con Google' });
    expect(
      new URL(link.getAttribute('href') ?? '', 'http://valora.test').searchParams.get('returnTo'),
    ).toBe('/');
  });

  it('no aparece si el servidor no tiene Google, ni si la consulta falla', async () => {
    const api = stubGoogle(PROVIDERS(false));
    renderAt('/entrar');
    await screen.findByRole('button', { name: 'Entrar' });
    await waitFor(() => {
      expect(api.requested.some(({ pathname }) => pathname === '/v1/auth/providers')).toBe(true);
    });
    expect(screen.queryByText('Continuar con Google')).not.toBeInTheDocument();
  });

  it('si la consulta falla, entrar con correo sigue ahí', async () => {
    stubGoogle({ status: 503, body: { code: 'UNAVAILABLE', message: 'x' } });
    renderAt('/entrar');
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByText('Continuar con Google')).not.toBeInTheDocument();
  });

  it('en /crear-cuenta está deshabilitado hasta marcar la política y lo dice', async () => {
    stubGoogle(PROVIDERS(true));
    renderAt('/crear-cuenta');

    const disabled = await screen.findByRole('button', { name: 'Continuar con Google' });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAccessibleDescription(/aceptas la política de tratamiento de datos/);
    expect(screen.queryByRole('link', { name: 'Continuar con Google' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /política de tratamiento de datos/ }));

    const link = screen.getByRole('link', { name: 'Continuar con Google' });
    expect(link).toHaveAttribute(
      'href',
      `/v1/auth/google/start?acceptPolicy=${POLICY_VERSION}&returnTo=%2F`,
    );
  });
});

describe('avisos de ?google=', () => {
  beforeEach(resetProviders);
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const MESSAGES: [string, string, string][] = [
    [
      '/entrar',
      'cancelado',
      'Cancelaste el inicio de sesión con Google. Puedes intentarlo de nuevo o usar tu correo.',
    ],
    [
      '/entrar',
      'fallo',
      'No pudimos iniciar sesión con Google. Intenta de nuevo en un momento o usa tu correo.',
    ],
    ['/entrar', 'suspendida', 'Esta cuenta está suspendida.'],
    [
      '/crear-cuenta',
      'cancelado',
      'Cancelaste el inicio de sesión con Google. Puedes intentarlo de nuevo o usar tu correo.',
    ],
    [
      '/crear-cuenta',
      'fallo',
      'No pudimos iniciar sesión con Google. Intenta de nuevo en un momento o usa tu correo.',
    ],
    ['/crear-cuenta', 'suspendida', 'Esta cuenta está suspendida.'],
    [
      '/crear-cuenta',
      'consentimiento',
      'Para crear tu cuenta con Google, acepta la política de datos',
    ],
  ];

  it.each(MESSAGES)(
    '%s con ?google=%s muestra el aviso con foco y limpia la dirección',
    async (path, code, message) => {
      stubGoogle(PROVIDERS(true));
      renderAt(`${path}?google=${code}&volver=/yo`);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      expect(alert).toHaveFocus();
      await waitFor(() => {
        expect(screen.getByTestId('where')).toHaveTextContent(`${path}?volver=%2Fyo`);
      });
      expect(screen.getByTestId('where')).not.toHaveTextContent('google=');
      expect(screen.getByRole('alert')).toHaveTextContent(message);
    },
  );

  it('un código desconocido se ignora y se quita de la dirección', async () => {
    stubGoogle(PROVIDERS(false));
    renderAt('/entrar?google=otra-cosa');

    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(/^\/entrar$/);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('consentimiento en /entrar lleva a /crear-cuenta con el aviso y la casilla resaltada', async () => {
    stubGoogle(PROVIDERS(true));
    renderAt('/entrar?google=consentimiento&volver=/yo');

    expect(await screen.findByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Para crear tu cuenta con Google, acepta la política de datos',
    );
    const check = screen.getByRole('checkbox', { name: /política de tratamiento de datos/ });
    expect(check).toBeInvalid();
    expect(check).toHaveAccessibleDescription(/acepta la política de datos/);
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(/^\/crear-cuenta\?volver=%2Fyo$/);
    });

    fireEvent.click(check);
    expect(check).toBeValid();
  });
});
