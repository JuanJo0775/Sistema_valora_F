import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, NO_SESSION, sessionAs, stubApi, stubPendingApi } from '../../test/fakeApi';
import { Profile } from './Profile';
import { SessionProvider } from './SessionProvider';
import { SignIn } from './SignIn';

const renderSignIn = (path: string) =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<h1>Inicio</h1>} />
          <Route path="/entrar" element={<SignIn />} />
          <Route path="/yo" element={<Profile />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

const signIn = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
};

const stubLogin = (login: FakeReply) =>
  stubApi({
    'GET /v1/auth/session': [NO_SESSION, sessionAs('reportante')],
    'POST /v1/auth/login': login,
  });

describe('iniciar sesión', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con correo y contraseña inicia la sesión y vuelve a donde estaba', async () => {
    const api = stubLogin({ status: 204 });
    renderSignIn('/entrar?volver=/yo');

    signIn('ana@correo.co', 'una clave larga');

    expect(await screen.findByRole('heading', { name: 'Hola' })).toBeInTheDocument();
    const login = api.calls.find(({ path }) => path === '/v1/auth/login');
    expect(JSON.parse(login?.body ?? '{}')).toEqual({
      email: 'ana@correo.co',
      password: 'una clave larga',
    });
  });

  it.each(['//malo.example', '/\\malo.example', 'https://malo.example/entrar'])(
    'si «volver» apunta a otro sitio (%s) lleva al inicio de Valora',
    async (volver) => {
      stubLogin({ status: 204 });
      renderSignIn(`/entrar?volver=${encodeURIComponent(volver)}`);

      signIn('ana@correo.co', 'una clave larga');

      expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument();
    },
  );

  it('si el correo o la contraseña no coinciden lo dice y deja el formulario', async () => {
    stubLogin({
      status: 401,
      body: { code: 'UNAUTHORIZED', message: 'Correo o contraseña incorrectos.' },
    });
    renderSignIn('/entrar');

    signIn('ana@correo.co', 'otra clave larga');

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(screen.getByLabelText('Correo')).toHaveValue('ana@correo.co');
  });

  it('mientras entra el botón dice «Entrando…» y no se puede volver a enviar', () => {
    stubPendingApi({ 'GET /v1/auth/session': NO_SESSION });
    renderSignIn('/entrar');

    signIn('ana@correo.co', 'una clave larga');

    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled();
  });

  it('lleva a crear cuenta sin perder a dónde volver', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderSignIn('/entrar?volver=/yo');

    expect(await screen.findByRole('link', { name: 'Crea una cuenta' })).toHaveAttribute(
      'href',
      '/crear-cuenta?volver=%2Fyo',
    );
  });

  it('la contraseña no queda guardada en el navegador ni en la dirección', async () => {
    stubLogin({ status: 204 });
    renderSignIn('/entrar?volver=/yo');

    signIn('ana@correo.co', 'una clave larga');
    await screen.findByRole('heading', { name: 'Hola' });

    const stored = JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]);
    expect(stored).not.toContain('una clave larga');
    expect(window.location.href).not.toContain('clave');
  });
});

describe('volver desde iniciar sesión', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trae un enlace de volver con respaldo en Yo', () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderSignIn('/entrar');

    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/yo');
  });
});
