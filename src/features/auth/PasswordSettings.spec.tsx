import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, NO_SESSION, sessionAs, stubApi } from '../../test/fakeApi';
import { SessionProvider } from './SessionProvider';
import { Settings } from './Settings';

const renderSettings = () =>
  render(
    <SessionProvider>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </SessionProvider>,
  );

const stub = (hasPassword: boolean, password: FakeReply = { status: 204 }, forgot?: FakeReply) =>
  stubApi({
    'GET /v1/auth/session': sessionAs('reportante', undefined, true, true, hasPassword),
    'POST /v1/me/password': password,
    'POST /v1/auth/forgot-password': forgot ?? { status: 202 },
  });

const fillNew = (next = 'una clave bien larga', confirm = next) => {
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), {
    target: { value: confirm },
  });
};

describe('ajustes › seguridad › contraseña', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sin sesión no hay bloque de seguridad', async () => {
    const api = stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderSettings();
    await waitFor(() => {
      expect(api.calls.length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('heading', { name: 'Seguridad' })).toBeNull();
  });

  it('con contraseña ofrece cambiarla, pidiendo la actual', async () => {
    const api = stub(true);
    renderSettings();

    expect(await screen.findByRole('heading', { name: 'Seguridad' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contraseña' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'la vieja' } });
    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByRole('status')).toHaveTextContent('cambiaste tu contraseña');
    const sent = api.calls.find(({ path }) => path === '/v1/me/password');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({
      currentPassword: 'la vieja',
      newPassword: 'una clave bien larga',
    });
    expect(sent?.headers.get('X-CSRF-Token')).toBe('token-1');
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
  });

  it('con contraseña no explica nada de Google ni ofrece crearla', async () => {
    stub(true);
    renderSettings();
    await screen.findByLabelText('Contraseña actual');
    expect(screen.queryByText(/Entraste con Google/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Crear una contraseña' })).toBeNull();
  });

  it('INVALID_PASSWORD marca la contraseña actual y enfoca el campo', async () => {
    stub(true, { status: 403, body: { code: 'INVALID_PASSWORD', message: 'x' } });
    renderSettings();
    fireEvent.change(await screen.findByLabelText('Contraseña actual'), {
      target: { value: 'mala' },
    });
    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByText(/La contraseña actual no es correcta/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Contraseña actual')).toHaveFocus();
    });
  });

  it('valida longitud y confirmación antes de enviar', async () => {
    const api = stub(true);
    renderSettings();
    fireEvent.change(await screen.findByLabelText('Contraseña actual'), { target: { value: 'x' } });
    fillNew('corta');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByText(/al menos 10 caracteres/)).toBeInTheDocument();
    fillNew('una clave bien larga', 'distinta');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(api.calls.some(({ path }) => path === '/v1/me/password')).toBe(false);
  });

  it('sin contraseña explica el motivo y deja crear la primera sin pedir la actual', async () => {
    const api = stub(false);
    renderSettings();

    expect(
      await screen.findByText(
        'Entraste con Google; si creas una contraseña también podrás entrar con tu correo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña actual')).toBeNull();
    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Crear una contraseña' }));

    expect(await screen.findByRole('status')).toHaveTextContent('creaste tu contraseña');
    const sent = api.calls.find(({ path }) => path === '/v1/me/password');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({ newPassword: 'una clave bien larga' });
    // Ya tiene contraseña: la pantalla pasa a «Cambiar contraseña» sin recargar.
    expect(await screen.findByLabelText('Contraseña actual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeInTheDocument();
  });

  it('REAUTH_REQUIRED ofrece confirmar con Google (vuelve a Ajustes) o recibir un correo', async () => {
    const api = stub(false, { status: 403, body: { code: 'REAUTH_REQUIRED', message: 'x' } });
    renderSettings();
    await screen.findByText(/Entraste con Google/);
    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Crear una contraseña' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Confirma que eres tú');
    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
    const google = screen.getByRole('link', { name: 'Confirmar con Google' });
    const url = new URL(google.getAttribute('href') ?? '', 'http://valora.test');
    expect(url.pathname).toBe('/v1/auth/google/start');
    expect(url.searchParams.get('returnTo')).toBe('/yo/ajustes');
    expect(url.searchParams.get('acceptPolicy')).toBe('2026-11');

    fireEvent.click(screen.getByRole('button', { name: 'Enviarme un correo para crearla' }));
    const mail = screen.getAllByLabelText('Correo')[0] as HTMLInputElement;
    fireEvent.change(mail, { target: { value: 'ana@correo.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme el enlace' }));
    expect(await screen.findByText(/Si hay una cuenta con ese correo/)).toBeInTheDocument();
    const forgot = api.calls.find(({ path }) => path === '/v1/auth/forgot-password');
    expect(JSON.parse(forgot?.body ?? '{}')).toEqual({ email: 'ana@correo.co' });
  });

  it('con 429 dice cuánto esperar', async () => {
    stub(true, {
      status: 429,
      body: { code: 'TOO_MANY_REQUESTS', message: 'x' },
      headers: { 'Retry-After': '90' },
    });
    renderSettings();
    fireEvent.change(await screen.findByLabelText('Contraseña actual'), { target: { value: 'x' } });
    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Espera 90 segundos.');
  });
});
