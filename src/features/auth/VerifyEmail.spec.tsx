import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, sessionAs, stubApi } from '../../test/fakeApi';
import { SessionProvider } from './SessionProvider';
import { VerifyEmail } from './VerifyEmail';
import { VerifyEmailBanner } from './VerifyEmailBanner';

const INVALID = {
  status: 422,
  body: { code: 'INVALID_VERIFICATION_TOKEN', message: 'El enlace no es válido.' },
};

const renderPage = (path: string) =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/verificar-correo" element={<VerifyEmail />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

describe('página de verificación de correo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('confirma el token una sola vez y dice que ya se puede registrar', async () => {
    const api = stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/auth/verify-email': { status: 204 },
    });

    renderPage('/verificar-correo?token=abc123');

    expect(await screen.findByRole('heading', { name: 'Correo verificado' })).toBeInTheDocument();
    const posts = api.calls.filter(({ path }) => path === '/v1/auth/verify-email');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0]?.body ?? '{}')).toEqual({ token: 'abc123' });
  });

  it('un enlace vencido o usado dice que no es válido y manda a iniciar sesión', async () => {
    stubApi({
      'GET /v1/auth/session': NO_SESSION,
      'POST /v1/auth/verify-email': INVALID,
    });

    renderPage('/verificar-correo?token=viejo');

    expect(
      await screen.findByRole('heading', { name: 'No pudimos verificar tu correo' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no es válido o ya venció/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/entrar');
  });

  it('sin token en el enlace no llama a la API', () => {
    const api = stubApi({ 'GET /v1/auth/session': NO_SESSION });

    renderPage('/verificar-correo');

    expect(
      screen.getByRole('heading', { name: 'No pudimos verificar tu correo' }),
    ).toBeInTheDocument();
    expect(api.calls.some(({ path }) => path === '/v1/auth/verify-email')).toBe(false);
  });

  it('un fallo de red no dice que el enlace sea inválido', async () => {
    stubApi({
      'GET /v1/auth/session': NO_SESSION,
      'POST /v1/auth/verify-email': {
        status: 500,
        body: { code: 'INTERNAL', message: 'Error.' },
      },
    });

    renderPage('/verificar-correo?token=abc');

    expect(await screen.findByText(/problema de conexión/)).toBeInTheDocument();
  });
});

describe('aviso de correo sin verificar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderBanner = () =>
    render(
      <SessionProvider>
        <VerifyEmailBanner />
      </SessionProvider>,
    );

  it('aparece con una cuenta sin verificar y deja pedir otro enlace', async () => {
    const api = stubApi({
      'GET /v1/auth/session': sessionAs('reportante', undefined, false),
      'POST /v1/auth/resend-verification': { status: 202 },
    });

    renderBanner();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviarme otro enlace' }));

    expect(await screen.findByText(/revisa tu bandeja/)).toBeInTheDocument();
    expect(api.calls.filter(({ path }) => path === '/v1/auth/resend-verification')).toHaveLength(1);
  });

  it('si el servidor limita los reenvíos, lo dice', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante', undefined, false),
      'POST /v1/auth/resend-verification': {
        status: 429,
        body: { code: 'TOO_MANY_ATTEMPTS', message: 'Demasiados intentos.' },
      },
    });

    renderBanner();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviarme otro enlace' }));

    expect(await screen.findByText(/Prueba de nuevo en una hora/)).toBeInTheDocument();
  });

  it('no aparece si el servidor no exige verificar (REQUIRE_VERIFIED_EMAIL=false)', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante', undefined, false, false) });
    renderBanner();
    await vi.waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Enviarme otro enlace' })).not.toBeInTheDocument();
  });

  it('no aparece con el correo verificado ni sin sesión', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });
    const { unmount } = renderBanner();
    await vi.waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    unmount();

    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderBanner();
    await vi.waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
