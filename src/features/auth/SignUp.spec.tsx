import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, NO_SESSION, sessionAs, stubApi, stubPendingApi } from '../../test/fakeApi';
import { Profile } from './Profile';
import { SessionProvider } from './SessionProvider';
import { SignUp } from './SignUp';

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

const fill = ({ name = 'Ana María', password = 'una clave larga', accept = true } = {}) => {
  fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@correo.co' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  if (accept)
    fireEvent.click(screen.getByRole('checkbox', { name: /política de tratamiento de datos/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
};

const stubSignUp = (register: FakeReply, login: FakeReply = { status: 204 }) =>
  stubApi({
    'GET /v1/auth/session': [NO_SESSION, sessionAs('reportante')],
    'POST /v1/auth/register': register,
    'POST /v1/auth/login': login,
  });

describe('crear cuenta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ADR-029, fase 2 (F#154): con Google no hace falta contraseña; la política se acepta en /bienvenida.
  it('ofrece crear la cuenta con Google con el mismo enlace que /entrar', () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderSignUp();

    expect(screen.getByRole('link', { name: 'Continuar con Google' })).toHaveAttribute(
      'href',
      '/v1/auth/google/start',
    );
  });

  it('con correo, contraseña y la política aceptada crea la cuenta, entra y vuelve', async () => {
    const api = stubSignUp({ status: 201 });
    renderSignUp();

    fill();

    expect(await screen.findByRole('heading', { name: 'Hola' })).toBeInTheDocument();
    const register = api.calls.find(({ path }) => path === '/v1/auth/register');
    expect(JSON.parse(register?.body ?? '{}')).toEqual({
      email: 'ana@correo.co',
      displayName: 'Ana María',
      password: 'una clave larga',
      acceptedPolicyVersion: '2026-11',
    });
  });

  // H-02: el correo de verificación sale con el registro; se recuerda qué se estaba haciendo.
  it('al crear la cuenta recuerda a dónde volver tras verificar el correo', async () => {
    stubSignUp({ status: 201 });
    renderSignUp('/crear-cuenta?volver=%2Fregistrar%3Fproducto%3Dabc');

    fill();
    await vi.waitFor(() => {
      expect(localStorage.getItem('valora:verificar-volver')).toBe('/registrar?producto=abc');
    });
  });

  // B#133: el nombre visible solo se ve en tu propia sesión (EC-08).
  it.each(['A', 'Ana2', 'ana@correo.co'])(
    'con un nombre que no vale («%s») no crea la cuenta y dice por qué',
    (name) => {
      const api = stubSignUp({ status: 201 });
      renderSignUp();

      fill({ name });

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Escribe tu nombre: de 2 a 40 letras, sin números ni símbolos.',
      );
      expect(api.calls.some(({ path }) => path === '/v1/auth/register')).toBe(false);
    },
  );

  it('dice que el nombre solo lo ves tú', () => {
    stubSignUp({ status: 201 });
    renderSignUp();

    expect(screen.getByText('Solo tú lo ves. Nunca se publica.')).toBeInTheDocument();
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

  it('si el correo ya tenía cuenta invita a entrar con su contraseña, sin revelarlo', async () => {
    stubSignUp(
      { status: 201 },
      { status: 401, body: { code: 'UNAUTHORIZED', message: 'Correo o contraseña incorrectos.' } },
    );
    renderSignUp();

    fill();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Si ya tenías una cuenta con ese correo, inicia sesión con tu contraseña.',
    );
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/entrar?volver=%2Fyo',
    );
  });

  it('mientras crea la cuenta el botón dice «Creando cuenta…» y no se reenvía', () => {
    stubPendingApi({ 'GET /v1/auth/session': NO_SESSION });
    renderSignUp();

    fill();

    expect(screen.getByRole('button', { name: 'Creando cuenta…' })).toBeDisabled();
  });

  it('lleva a iniciar sesión sin perder a dónde volver', () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderSignUp();

    expect(screen.getByRole('link', { name: 'Inicia sesión' })).toHaveAttribute(
      'href',
      '/entrar?volver=%2Fyo',
    );
  });
});

describe('volver desde crear cuenta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trae un enlace de volver con respaldo en Yo', () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderSignUp('/crear-cuenta');

    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/yo');
  });
});

describe('crear cuenta: errores en línea y explicación', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con el formulario vacío marca los campos, los enlaza y lleva el foco al primero', () => {
    const api = stubSignUp({ status: 201 });
    renderSignUp();

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    const name = screen.getByLabelText('Tu nombre');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription(/Escribe tu nombre/);
    expect(screen.getByLabelText('Correo')).toHaveAccessibleDescription('Escribe tu correo.');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('checkbox', { name: /política/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(name).toHaveFocus();
    expect(api.calls.some(({ path }) => path === '/v1/auth/register')).toBe(false);
  });

  it('desde registrar un precio explica por qué hace falta la cuenta', () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderSignUp('/crear-cuenta?volver=/registrar');

    expect(screen.getByText(/Para registrar un precio necesitas una cuenta/)).toBeInTheDocument();
  });
});
