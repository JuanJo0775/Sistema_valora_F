import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, stubApi } from '../../test/fakeApi';
import { Profile } from './Profile';
import { SessionProvider } from './SessionProvider';
import { SignUp } from './SignUp';

const unauthorized = {
  status: 401,
  body: { code: 'UNAUTHORIZED', message: 'Se requiere sesión.' },
};
const reporter = { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } };

const renderSignUp = (path = '/crear-cuenta?volver=/yo') =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/crear-cuenta" element={<SignUp />} />
          <Route path="/yo" element={<Profile />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

const fill = ({ password = 'una clave larga', accept = true } = {}) => {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@correo.co' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  if (accept)
    fireEvent.click(screen.getByRole('checkbox', { name: /política de tratamiento de datos/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
};

const stubSignUp = (register: FakeReply, login: FakeReply = { status: 204 }) =>
  stubApi({
    'GET /v1/auth/session': [unauthorized, reporter],
    'POST /v1/auth/register': register,
    'POST /v1/auth/login': login,
  });

describe('crear cuenta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con correo, contraseña y la política aceptada crea la cuenta, entra y vuelve', async () => {
    const api = stubSignUp({ status: 201 });
    renderSignUp();

    fill();

    expect(await screen.findByText('Entraste como reportante.')).toBeInTheDocument();
    const register = api.calls.find(({ path }) => path === '/v1/auth/register');
    expect(JSON.parse(register?.body ?? '{}')).toEqual({
      email: 'ana@correo.co',
      password: 'una clave larga',
      acceptedPolicyVersion: '2026-11',
    });
  });

  it('sin aceptar la política no crea la cuenta y dice por qué', () => {
    const api = stubSignUp({ status: 201 });
    renderSignUp();

    fill({ accept: false });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Para crear la cuenta debes aceptar la política de tratamiento de datos.',
    );
    expect(api.calls.some(({ path }) => path === '/v1/auth/register')).toBe(false);
  });

  it('con una contraseña de menos de 10 caracteres lo dice sin llamar al servidor', () => {
    const api = stubSignUp({ status: 201 });
    renderSignUp();

    fill({ password: 'corta' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La contraseña debe tener al menos 10 caracteres.',
    );
    expect(api.calls.some(({ path }) => path === '/v1/auth/register')).toBe(false);
  });

  it('si el servidor rechaza el registro muestra su mensaje', async () => {
    stubSignUp({
      status: 429,
      body: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Espera unos minutos.' },
    });
    renderSignUp();

    fill();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos. Espera unos minutos.',
    );
  });
});
