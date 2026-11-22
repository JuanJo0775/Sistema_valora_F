import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, NO_SESSION, stubApi } from '../../test/fakeApi';
import { ForgotPassword } from './ForgotPassword';
import { SessionProvider } from './SessionProvider';
import { SignIn } from './SignIn';

const SENT =
  'Si hay una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Vence en 1 hora.';

const renderApp = (path: string) =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/entrar" element={<SignIn />} />
          <Route path="/olvide-contrasena" element={<ForgotPassword />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

const stub = (forgot: FakeReply) =>
  stubApi({ 'GET /v1/auth/session': NO_SESSION, 'POST /v1/auth/forgot-password': forgot });

const ask = (email: string) => {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviarme el enlace' }));
};

describe('olvidé mi contraseña', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('«Entrar» ofrece el enlace y lleva el correo escrito a la pantalla nueva', async () => {
    stub({ status: 202 });
    renderApp('/entrar');
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@correo.co' } });
    fireEvent.click(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '¿Olvidaste tu contraseña?' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toHaveValue('ana@correo.co');
  });

  it('pide un correo válido y enfoca el campo', async () => {
    const api = stub({ status: 202 });
    renderApp('/olvide-contrasena');
    ask('sin-arroba');

    expect(await screen.findByText(/Escribe un correo válido/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Correo')).toHaveFocus();
    });
    expect(api.calls.some(({ path }) => path === '/v1/auth/forgot-password')).toBe(false);
  });

  it('envía el correo y muestra siempre el mismo mensaje, con el consejo del spam', async () => {
    const api = stub({ status: 202 });
    renderApp('/olvide-contrasena');
    ask(' ana@correo.co ');

    const message = await screen.findByText(SENT);
    expect(message.closest('[role="status"]')).toBeInTheDocument();
    await waitFor(() => {
      expect(message.closest('[role="status"]')).toHaveFocus();
    });
    expect(screen.getByText(/revisa la carpeta de spam/)).toBeInTheDocument();
    const sent = api.calls.find(({ path }) => path === '/v1/auth/forgot-password');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({ email: 'ana@correo.co' });
  });

  it('el reenvío se habilita a los 60 s, con cuenta regresiva', async () => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    const api = stub({ status: 202 });
    renderApp('/olvide-contrasena');
    ask('ana@correo.co');
    await screen.findByText(SENT);

    const resend = screen.getByRole('button', { name: 'Reenviar el enlace' });
    expect(resend).toBeDisabled();
    expect(screen.getByText(/Podrás reenviarlo en 60 s/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText(/Podrás reenviarlo en [45]\d s/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(55_000);
    });
    expect(resend).toBeEnabled();

    fireEvent.click(resend);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reenviar el enlace' })).toBeDisabled();
    });
    expect(api.calls.filter(({ path }) => path === '/v1/auth/forgot-password')).toHaveLength(2);
  });

  it('con 429 dice cuánto esperar y bloquea el botón hasta que pase', async () => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    stub({
      status: 429,
      body: { code: 'TOO_MANY_REQUESTS', message: 'x' },
      headers: { 'Retry-After': '30' },
    });
    renderApp('/olvide-contrasena');
    ask('ana@correo.co');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hiciste demasiados intentos. Espera 30 segundos.',
    );
    expect(screen.queryByText(SENT)).toBeNull();
    const button = screen.getByRole('button', { name: 'Enviarme el enlace' });
    expect(button).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(button).toBeEnabled();
  });

  it('«Usar otro correo» vuelve al formulario', async () => {
    stub({ status: 202 });
    renderApp('/olvide-contrasena');
    ask('ana@correo.co');
    await screen.findByText(SENT);
    fireEvent.click(screen.getByRole('button', { name: 'Usar otro correo' }));
    expect(screen.getByLabelText('Correo')).toHaveValue('ana@correo.co');
  });

  it('sin red lo dice y no muestra el mensaje de éxito', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: Request) =>
        input.method === 'POST'
          ? Promise.reject(new TypeError('fail'))
          : Promise.resolve(new Response(null, { status: 401 })),
      ),
    );
    renderApp('/olvide-contrasena');
    ask('ana@correo.co');
    expect(await screen.findByText(/No hay conexión con Valora/)).toBeInTheDocument();
    expect(screen.queryByText(SENT)).toBeNull();
  });
});
