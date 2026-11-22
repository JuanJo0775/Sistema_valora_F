import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, NO_SESSION, stubApi } from '../../test/fakeApi';
import { ResetPassword } from './ResetPassword';
import { SessionProvider } from './SessionProvider';

const renderAt = (path: string) =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/restablecer-contrasena" element={<ResetPassword />} />
          <Route path="/olvide-contrasena" element={<h1>Olvidé</h1>} />
          <Route path="/entrar" element={<h1>Entrar</h1>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

const stub = (reset: FakeReply) =>
  stubApi({ 'GET /v1/auth/session': NO_SESSION, 'POST /v1/auth/reset-password': reset });

const save = (password: string, confirm = password) => {
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), {
    target: { value: confirm },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
};

describe('restablecer la contraseña', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
    localStorage.clear();
  });

  it('lee el token, lo quita de la dirección y nunca lo guarda', async () => {
    window.history.replaceState(null, '', '/restablecer-contrasena?token=abc123');
    const api = stub({ status: 204 });
    renderAt('/restablecer-contrasena?token=abc123');

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    expect(window.location.pathname).toBe('/restablecer-contrasena');
    save('una clave bien larga');

    expect(
      await screen.findByRole('heading', { name: 'Tu contraseña quedó actualizada' }),
    ).toBeInTheDocument();
    const sent = api.calls.find(({ path }) => path === '/v1/auth/reset-password');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({
      token: 'abc123',
      password: 'una clave bien larga',
    });
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('abc123');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/entrar');
  });

  it('muestra la regla de la contraseña y valida longitud y coincidencia', async () => {
    const api = stub({ status: 204 });
    renderAt('/restablecer-contrasena?token=abc');
    expect(screen.getByText('Mínimo 10 caracteres.')).toBeInTheDocument();

    save('corta');
    expect(await screen.findByText(/al menos 10 caracteres/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Contraseña nueva')).toHaveFocus();
    });
    save('una clave bien larga', 'otra distinta');
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(api.calls.some(({ path }) => path === '/v1/auth/reset-password')).toBe(false);
  });

  it('cada campo de contraseña tiene su ojo', () => {
    stub({ status: 204 });
    renderAt('/restablecer-contrasena?token=abc');
    expect(screen.getAllByRole('button', { name: 'Mostrar contraseña' })).toHaveLength(2);
  });

  it('INVALID_TOKEN: dice que el enlace venció y ofrece pedir otro', async () => {
    stub({ status: 422, body: { code: 'INVALID_TOKEN', message: 'x' } });
    renderAt('/restablecer-contrasena?token=viejo');
    save('una clave bien larga');

    const heading = await screen.findByRole('heading', { name: 'El enlace venció o ya se usó' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(screen.getByRole('link', { name: 'Pedir otro enlace' })).toHaveAttribute(
      'href',
      '/olvide-contrasena',
    );
  });

  it('sin token es lo mismo, sin llamar al servidor', () => {
    const api = stub({ status: 204 });
    renderAt('/restablecer-contrasena');
    expect(
      screen.getByRole('heading', { name: 'El enlace venció o ya se usó' }),
    ).toBeInTheDocument();
    expect(api.calls.some(({ path }) => path === '/v1/auth/reset-password')).toBe(false);
  });

  it('un 400 del servidor se explica sin perder lo escrito', async () => {
    stub({ status: 400, body: { code: 'VALIDATION_ERROR', message: 'password: x' } });
    renderAt('/restablecer-contrasena?token=abc');
    save('una clave bien larga');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no cumple las reglas/);
    expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('una clave bien larga');
  });

  it('con 429 dice cuánto esperar', async () => {
    stub({
      status: 429,
      body: { code: 'TOO_MANY_REQUESTS', message: 'x' },
      headers: { 'Retry-After': '45' },
    });
    renderAt('/restablecer-contrasena?token=abc');
    save('una clave bien larga');
    expect(await screen.findByRole('alert')).toHaveTextContent('Espera 45 segundos.');
  });
});
