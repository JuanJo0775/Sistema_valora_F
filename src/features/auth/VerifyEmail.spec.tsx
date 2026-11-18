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
    expect(screen.getByText(/ya se usó o venció/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/entrar');
  });

  it('sin token en el enlace no llama a la API', async () => {
    const api = stubApi({ 'GET /v1/auth/session': NO_SESSION });

    renderPage('/verificar-correo');

    expect(
      await screen.findByRole('heading', { name: 'No pudimos verificar tu correo' }),
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
        <MemoryRouter>
          <VerifyEmailBanner />
        </MemoryRouter>
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

describe('página de verificación según haya sesión y el estado del enlace', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin sesión, tras verificar, pide iniciar sesión y no dice que ya puede registrar', async () => {
    stubApi({
      'GET /v1/auth/session': NO_SESSION,
      'POST /v1/auth/verify-email': { status: 204 },
    });

    renderPage('/verificar-correo?token=abc');

    expect(await screen.findByRole('heading', { name: 'Correo verificado' })).toBeInTheDocument();
    expect(screen.queryByText('Ya puedes registrar precios.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/entrar?volver=%2Fregistrar',
    );
  });

  it('un enlace ya usado, con la sesión verificada, dice que el correo ya está verificado', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/auth/verify-email': INVALID,
    });

    renderPage('/verificar-correo?token=usado');

    expect(
      await screen.findByRole('heading', { name: 'Tu correo ya está verificado' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ya venció/)).not.toBeInTheDocument();
  });

  it('un enlace usado sin sesión sugiere iniciar sesión por si ya estaba verificado', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION, 'POST /v1/auth/verify-email': INVALID });

    renderPage('/verificar-correo?token=usado');

    expect(await screen.findByText(/tu correo está verificado: inicia sesión/)).toBeInTheDocument();
  });

  it('con sesión sin verificar y sin enlace deja pedir otro', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante', undefined, false),
      'POST /v1/auth/resend-verification': { status: 202 },
    });

    renderPage('/verificar-correo');

    fireEvent.click(await screen.findByRole('button', { name: 'Enviarme otro enlace' }));
    expect(await screen.findByText(/revisa tu bandeja/)).toBeInTheDocument();
  });
});

describe('aviso compacto de correo sin verificar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('se puede cerrar y no vuelve a salir durante la sesión de navegación', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante', undefined, false) });
    const { unmount } = render(
      <SessionProvider>
        <MemoryRouter>
          <VerifyEmailBanner />
        </MemoryRouter>
      </SessionProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText(/Verifica tu correo/)).not.toBeInTheDocument();
    unmount();

    render(
      <SessionProvider>
        <MemoryRouter>
          <VerifyEmailBanner />
        </MemoryRouter>
      </SessionProvider>,
    );
    await vi.waitFor(() => {
      expect(screen.queryByText(/Verifica tu correo/)).not.toBeInTheDocument();
    });
  });
});

// H-02: tras verificar, la persona sigue con lo que estaba haciendo.
describe('verificar el correo sin perder lo que se estaba haciendo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const WHAT = '/registrar?producto=3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d';

  it('al pedir el reenvío desde la pantalla de registrar recuerda a dónde volver', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante', undefined, false),
      'POST /v1/auth/resend-verification': { status: 202 },
    });
    render(
      <SessionProvider>
        <MemoryRouter initialEntries={[WHAT]}>
          <VerifyEmailBanner />
        </MemoryRouter>
      </SessionProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Enviarme otro enlace' }));
    await screen.findByText(/revisa tu bandeja/);

    expect(localStorage.getItem('valora:verificar-volver')).toBe(WHAT);
  });

  it('con sesión, ofrece «Seguir con registrar un precio» y lo lleva al producto', async () => {
    localStorage.setItem('valora:verificar-volver', WHAT);
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/auth/verify-email': { status: 204 },
    });

    renderPage('/verificar-correo?token=abc');

    expect(await screen.findByRole('link', { name: 'Seguir con registrar un precio' })).toHaveAttribute(
      'href',
      WHAT,
    );
    // Ya se usó: la próxima vez no se ofrece de nuevo.
    expect(localStorage.getItem('valora:verificar-volver')).toBeNull();
  });

  it('sin sesión, entrar devuelve a lo que se estaba haciendo', async () => {
    localStorage.setItem('valora:verificar-volver', WHAT);
    stubApi({
      'GET /v1/auth/session': NO_SESSION,
      'POST /v1/auth/verify-email': { status: 204 },
    });

    renderPage('/verificar-correo?token=abc');

    expect(
      await screen.findByRole('link', { name: 'Iniciar sesión y seguir con registrar un precio' }),
    ).toHaveAttribute('href', `/entrar?volver=${encodeURIComponent(WHAT)}`);
  });

  it('una dirección ?volver= que sale de la app no se sigue', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/auth/verify-email': { status: 204 },
    });

    renderPage('/verificar-correo?token=abc&volver=%2F%2Fotro.sitio');

    expect(await screen.findByRole('link', { name: 'Registrar un precio' })).toHaveAttribute(
      'href',
      '/registrar',
    );
    expect(screen.queryByRole('link', { name: /Seguir con/ })).not.toBeInTheDocument();
  });
});
