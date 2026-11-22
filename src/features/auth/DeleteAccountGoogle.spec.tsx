import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi } from '../../test/fakeApi';
import { DeleteAccount } from './DeleteAccount';
import { SessionProvider } from './SessionProvider';

const renderAt = () =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/yo/eliminar-cuenta']}>
        <Routes>
          <Route path="/yo/ajustes" element={<h1>Ajustes</h1>} />
          <Route path="/yo/eliminar-cuenta" element={<DeleteAccount />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

const stub = (deletion: FakeReply, hasPassword: boolean) =>
  stubApi({
    'GET /v1/auth/session': sessionAs('reportante', undefined, true, true, hasPassword),
    'POST /v1/me/account-deletion': deletion,
  });

const submitButton = () =>
  screen.getByRole('button', { name: /Eliminar mi cuenta definitivamente/ });

describe('eliminar la cuenta creada con Google', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('no pide contraseña: explica y exige solo la casilla', async () => {
    stub({ status: 202 }, false);
    renderAt();

    expect(await screen.findByText(/Tu cuenta usa Google\./)).toBeInTheDocument();
    expect(screen.getByText(/confirma que eres tú/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Tu contraseña')).toBeNull();
    expect(screen.getByText(/Tienes 10 días para cambiar de opinión/)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(submitButton()).toBeEnabled();
  });

  it('envía un cuerpo vacío y muestra la pantalla final sin hablar de contraseña', async () => {
    const api = stub({ status: 202, body: { scheduledFor: '2026-12-01T15:30:00.000Z' } }, false);
    renderAt();
    await screen.findByText(/Tu cuenta usa Google\./);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton());

    const heading = await screen.findByRole('heading', {
      name: 'Tu cuenta quedó programada para eliminarse',
    });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    const sent = api.calls.find(({ path }) => path === '/v1/me/account-deletion');
    expect(JSON.parse(sent?.body ?? 'null')).toEqual({});
    expect(screen.getByRole('status')).toHaveTextContent(/tienes 10 días para cambiar de opinión/);
    expect(screen.getByRole('status')).not.toHaveTextContent(/contraseña/);
  });

  it('REAUTH_REQUIRED ofrece confirmar con Google (vuelve aquí) o crear una contraseña', async () => {
    stub({ status: 403, body: { code: 'REAUTH_REQUIRED', message: 'x' } }, false);
    renderAt();
    await screen.findByText(/Tu cuenta usa Google\./);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton());

    const alert = await screen.findByText(/Confirma que eres tú\./);
    await waitFor(() => {
      expect(alert.closest('[role="alert"]')).toHaveFocus();
    });
    const google = screen.getByRole('link', { name: 'Confirmar con Google' });
    const url = new URL(google.getAttribute('href') ?? '', 'http://valora.test');
    expect(url.pathname).toBe('/v1/auth/google/start');
    expect(url.searchParams.get('returnTo')).toBe('/yo/eliminar-cuenta');
    expect(url.searchParams.get('acceptPolicy')).toBe('2026-11');
    expect(screen.getByRole('link', { name: 'Crear una contraseña primero' })).toHaveAttribute(
      'href',
      '/yo/ajustes',
    );
    // La cuenta sigue activa: se puede reintentar.
    expect(submitButton()).toBeEnabled();
  });

  it('una cuenta con contraseña sigue pidiéndola y enviándola', async () => {
    const api = stub({ status: 202, body: { scheduledFor: '2026-12-01T15:30:00.000Z' } }, true);
    renderAt();
    expect(screen.queryByText(/Tu cuenta usa Google/)).toBeNull();
    fireEvent.change(await screen.findByLabelText('Tu contraseña'), { target: { value: 'clave' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton());
    await screen.findByRole('heading', { name: 'Tu cuenta quedó programada para eliminarse' });
    const sent = api.calls.find(({ path }) => path === '/v1/me/account-deletion');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({ password: 'clave' });
    expect(screen.getByRole('status')).toHaveTextContent(
      /inicia sesión con tu correo y contraseña/,
    );
  });
});
