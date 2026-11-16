import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, stubApi } from '../../test/fakeApi';
import { Profile } from './Profile';
import { SessionProvider } from './SessionProvider';
import { SignIn } from './SignIn';

const unauthorized = {
  status: 401,
  body: { code: 'UNAUTHORIZED', message: 'Se requiere sesión.' },
};
const reporter = { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } };

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
  stubApi({ 'GET /v1/auth/session': [unauthorized, reporter], 'POST /v1/auth/login': login });

describe('iniciar sesión', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con correo y contraseña inicia la sesión y vuelve a donde estaba', async () => {
    const api = stubLogin({ status: 204 });
    renderSignIn('/entrar?volver=/yo');

    signIn('ana@correo.co', 'una clave larga');

    expect(await screen.findByText('Entraste como reportante.')).toBeInTheDocument();
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
});
