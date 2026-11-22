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

  it('no pide contraseña: explica, pide el correo y exige la casilla', async () => {
    stub({ status: 202 }, false);
    renderAt();

    expect(await screen.findByText(/Tu cuenta usa Google./)).toBeInTheDocument();
    expect(screen.getByText(/Para eliminarla escribe tu correo/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Tu contraseña')).toBeNull();
    expect(screen.getByText(/Tienes 10 días para cambiar de opinión/)).toBeInTheDocument();
    expect(screen.getByText(/vuelve a entrar con Google durante los 10 días/)).toBeInTheDocument();
    expect(screen.queryByText(/correo y contraseña/)).toBeNull();
    expect(submitButton()).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(submitButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Escribe tu correo para confirmar'), {
      target: { value: 'ana@correo.co' },
    });
    expect(submitButton()).toBeEnabled();
  });

  it('envía confirmEmail y muestra la pantalla final con la salida de Google', async () => {
    const api = stub({ status: 202, body: { scheduledFor: '2026-12-01T15:30:00.000Z' } }, false);
    renderAt();
    fireEvent.change(await screen.findByLabelText('Escribe tu correo para confirmar'), {
      target: { value: ' ana@correo.co ' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton());

    const heading = await screen.findByRole('heading', {
      name: 'Tu cuenta quedó programada para eliminarse',
    });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    const sent = api.calls.find(({ path }) => path === '/v1/me/account-deletion');
    expect(JSON.parse(sent?.body ?? 'null')).toEqual({ confirmEmail: 'ana@correo.co' });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Para restaurarla, vuelve a entrar con Google durante los 10 días.',
    );
    expect(screen.getByRole('status')).not.toHaveTextContent(/contraseña/);
  });

  it('INVALID_CONFIRMATION marca el correo y enfoca el campo', async () => {
    stub({ status: 403, body: { code: 'INVALID_CONFIRMATION', message: 'x' } }, false);
    renderAt();
    fireEvent.change(await screen.findByLabelText('Escribe tu correo para confirmar'), {
      target: { value: 'otro@correo.co' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton());

    expect(
      await screen.findByText('Ese correo no coincide con el de tu cuenta.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Escribe tu correo para confirmar')).toHaveFocus();
    });
    expect(submitButton()).toBeEnabled();
  });

  it('otros errores se explican igual que con contraseña', async () => {
    stub({ status: 403, body: { code: 'MODERATOR_CANNOT_DELETE', message: 'x' } }, false);
    renderAt();
    fireEvent.change(await screen.findByLabelText('Escribe tu correo para confirmar'), {
      target: { value: 'ana@correo.co' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton());
    expect(await screen.findByText(/moderación.*traspasa el rol/s)).toBeInTheDocument();
  });

  it('una cuenta con contraseña sigue pidiéndola y enviándola', async () => {
    const api = stub({ status: 202, body: { scheduledFor: '2026-12-01T15:30:00.000Z' } }, true);
    renderAt();
    expect(screen.queryByText(/Tu cuenta usa Google/)).toBeNull();
    expect(screen.queryByLabelText('Escribe tu correo para confirmar')).toBeNull();
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
