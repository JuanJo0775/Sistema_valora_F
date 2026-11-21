import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, NO_SESSION, sessionAs, stubApi } from '../../test/fakeApi';
import { POLICY_VERSION } from '../legal/policy';
import { DeleteAccount } from './DeleteAccount';
import { SessionProvider } from './SessionProvider';

const renderAt = () =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/yo/eliminar-cuenta']}>
        <Routes>
          <Route path="/" element={<h1>Inicio</h1>} />
          <Route path="/entrar" element={<h1>Entrar</h1>} />
          <Route path="/yo/ajustes" element={<h1>Ajustes</h1>} />
          <Route path="/yo/eliminar-cuenta" element={<DeleteAccount />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

const stub = (deletion: FakeReply, session: FakeReply = sessionAs('reportante')) =>
  stubApi({
    'GET /v1/auth/session': session,
    'POST /v1/me/account-deletion': deletion,
  });

const submitButton = () =>
  screen.getByRole('button', { name: /Eliminar mi cuenta definitivamente|Programando/ });
const fill = async (password = 'mi clave larga') => {
  fireEvent.change(await screen.findByLabelText('Tu contraseña'), { target: { value: password } });
  fireEvent.click(screen.getByRole('checkbox'));
};

describe('eliminar mi cuenta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('explica qué se borra, qué se conserva y los 10 días de gracia', async () => {
    stub({ status: 202 });
    renderAt();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Eliminar mi cuenta' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tus sesiones abiertas/)).toBeInTheDocument();
    expect(screen.getByText(/sin tu nombre ni tu correo/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /10 días para cambiar de opinión/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no se puede deshacer/, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/yo/ajustes');
  });

  it('el botón sigue deshabilitado hasta tener contraseña y confirmación', async () => {
    stub({ status: 202 });
    renderAt();
    fireEvent.change(await screen.findByLabelText('Tu contraseña'), { target: { value: 'x' } });
    expect(submitButton()).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(submitButton()).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Tu contraseña'), { target: { value: '' } });
    expect(submitButton()).toBeDisabled();
  });

  it('con éxito programa la eliminación, cierra la sesión local y muestra la fecha', async () => {
    localStorage.setItem('valora:ultimo-rol', 'reportante');
    const api = stub({ status: 202, body: { scheduledFor: '2026-12-01T15:30:00.000Z' } });
    renderAt();
    await fill();

    fireEvent.click(submitButton());

    const heading = await screen.findByRole('heading', {
      name: 'Tu cuenta quedó programada para eliminarse',
    });
    expect(heading).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(/Se eliminará el .*2026/);
    expect(screen.getByRole('status')).toHaveTextContent(/tienes 10 días para cambiar de opinión/);
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/');
    const sent = api.calls.find(({ path }) => path === '/v1/me/account-deletion');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({ password: 'mi clave larga' });
    expect(sent?.headers.get('X-CSRF-Token')).toBe('token-1');
    expect(localStorage.getItem('valora:ultimo-rol')).toBeNull();
    // La sesión local quedó cerrada y la pantalla final no se rompe ni redirige.
    expect(screen.queryByRole('heading', { name: 'Entrar' })).toBeNull();
  });

  it('mientras envía dice «Programando…» y no se puede reenviar', async () => {
    stub({ status: 202, pending: true });
    renderAt();
    await fill();
    fireEvent.click(submitButton());
    expect(await screen.findByRole('button', { name: 'Programando…' })).toBeDisabled();
  });

  it('contraseña incorrecta: error en el campo y foco en él', async () => {
    stub({ status: 403, body: { code: 'INVALID_PASSWORD', message: 'x' } });
    renderAt();
    await fill();
    fireEvent.click(submitButton());

    expect(await screen.findByText(/La contraseña no es correcta/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Tu contraseña')).toHaveFocus();
    });
    expect(submitButton()).toBeEnabled();
  });

  it.each([
    ['LAST_MODERATOR_CANNOT_DELETE', 403, /único moderador.*traspasa el rol/s],
    ['MODERATOR_CANNOT_DELETE', 403, /moderación.*traspasa el rol/s],
    ['TOO_MANY_REQUESTS', 429, /demasiados intentos\. Espera 60 segundos/i],
    ['INTERNAL_ERROR', 500, /problema de Valora.*sigue activa/s],
  ])('%s muestra un mensaje claro y enfoca el aviso', async (code, status, text) => {
    stub({
      status,
      body: { code, message: 'x' },
      headers: status === 429 ? { 'Retry-After': '60' } : {},
    });
    renderAt();
    await fill();
    fireEvent.click(submitButton());

    const message = await screen.findByText(text);
    expect(message.closest('[role="alert"]')).toHaveFocus();
  });

  it('sin red lo dice y deja reintentar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: Request) =>
        input.method === 'POST'
          ? Promise.reject(new TypeError('network'))
          : Promise.resolve(new Response(JSON.stringify(sessionAs('reportante').body))),
      ),
    );
    renderAt();
    await fill();
    fireEvent.click(submitButton());
    expect(await screen.findByText(/No hay conexión con Valora/)).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it('una sesión vencida (401) lleva a entrar', async () => {
    stub({ status: 401, body: { code: 'UNAUTHORIZED', message: 'x' } });
    renderAt();
    await fill();
    fireEvent.click(submitButton());
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('sin sesión lleva a entrar', async () => {
    stub({ status: 202 }, NO_SESSION);
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('a un moderador le avisa que puede no poder eliminarse', async () => {
    stub({ status: 202 }, sessionAs('moderador'));
    renderAt();
    expect(await screen.findByText(/Tu cuenta es de moderación/)).toBeInTheDocument();
  });

  it('«Mi cuenta usa Google» quita la contraseña y envía {}', async () => {
    const api = stub({ status: 202, body: { scheduledFor: '2026-12-01T15:30:00.000Z' } });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Mi cuenta usa Google' }));
    expect(screen.queryByLabelText('Tu contraseña')).toBeNull();
    expect(submitButton()).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(submitButton()).toBeEnabled();
    fireEvent.click(submitButton());

    await screen.findByRole('heading', { name: 'Tu cuenta quedó programada para eliminarse' });
    const sent = api.calls.find(({ path }) => path === '/v1/me/account-deletion');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({});
  });

  it('REAUTH_REQUIRED ofrece «Confirmar con Google» y vuelve a esta pantalla', async () => {
    stub({ status: 403, body: { code: 'REAUTH_REQUIRED', message: 'x' } });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Mi cuenta usa Google' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton());

    const confirm = await screen.findByRole('link', { name: 'Confirmar con Google' });
    const url = new URL(confirm.getAttribute('href') ?? '', 'http://valora.test');
    expect(url.pathname).toBe('/v1/auth/google/start');
    expect(url.searchParams.get('returnTo')).toBe('/yo/eliminar-cuenta');
    expect(url.searchParams.get('acceptPolicy')).toBe(POLICY_VERSION);
    expect(screen.getByText(/volviendo a entrar con Google/)).toBeInTheDocument();
  });

  it('REAUTH_REQUIRED con contraseña también pasa al modo Google', async () => {
    stub({ status: 403, body: { code: 'REAUTH_REQUIRED', message: 'x' } });
    renderAt();
    await fill();
    fireEvent.click(submitButton());

    expect(await screen.findByRole('link', { name: 'Confirmar con Google' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Tu contraseña')).toBeNull();
  });
});
