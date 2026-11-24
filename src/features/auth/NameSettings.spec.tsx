import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { type FakeReply, NO_SESSION, sessionAs, stubApi } from '../../test/fakeApi';
import { Profile } from './Profile';
import { SessionProvider } from './SessionProvider';
import { Settings } from './Settings';

// Ajustes y «Yo» comparten la sesión: así se ve que el nombre nuevo llega a toda la app.
const renderApp = () =>
  render(
    <SessionProvider>
      <MemoryRouter>
        <Settings />
        <Profile />
      </MemoryRouter>
    </SessionProvider>,
  );

const stub = (name: string | undefined, patch: FakeReply = { status: 200 }) =>
  stubApi({
    'GET /v1/auth/session': sessionAs('reportante', undefined, true, true, true, name),
    'PATCH /v1/me/profile': patch,
  });

const ok = (displayName: string): FakeReply => ({ status: 200, body: { displayName } });
const invalid = (): FakeReply => ({
  status: 400,
  body: {
    code: 'VALIDATION_ERROR',
    message: 'displayName: debe tener de 2 a 40 letras, sin números, correos ni símbolos',
  },
});

async function openForm(button = 'Cambiar nombre') {
  fireEvent.click(await screen.findByRole('button', { name: button }));
  return screen.getByLabelText('Tu nombre');
}
const type = (field: HTMLElement, value: string) => {
  fireEvent.change(field, { target: { value } });
};
const save = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
};
const patches = (api: ReturnType<typeof stubApi>) =>
  api.calls.filter(({ method }) => method === 'PATCH');

describe('ajustes › cuenta › nombre', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sin sesión no muestra la fila', async () => {
    const api = stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderApp();
    await waitFor(() => {
      expect(api.calls.length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('button', { name: /nombre/i })).toBeNull();
  });

  it('muestra el nombre actual y abre el formulario con el campo precargado y enfocado', async () => {
    stub('Sara');
    renderApp();
    const row = (await screen.findByRole('button', { name: 'Cambiar nombre' })).parentElement;
    expect(row).toHaveTextContent('Sara');
    const field = await openForm();
    expect(field).toHaveValue('Sara');
    expect(field).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Cambiar nombre' })).toBeNull();
  });

  it('guarda, avisa en una región de estado y actualiza el nombre en toda la app', async () => {
    const api = stub('Sara', ok('Sara Lucía'));
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Hola, Sara' })).toBeVisible();
    type(await openForm(), '  Sara Lucía ');
    save();

    expect(await screen.findByText(/Listo: tu nombre ahora es Sara Lucía/)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Sara Lucía');
    const sent = patches(api)[0];
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({ displayName: 'Sara Lucía' });
    expect(sent?.headers.get('X-CSRF-Token')).toBe('token-1');
    expect(screen.getByRole('heading', { name: 'Hola, Sara Lucía' })).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cambiar nombre' })).toHaveFocus();
    });
    expect(screen.queryByLabelText('Tu nombre')).toBeNull();
  });

  it('mientras guarda deshabilita el botón y dice «Guardando…»', async () => {
    stub('Sara', { status: 200, pending: true });
    renderApp();
    type(await openForm(), 'Ana');
    save();
    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });

  it('una cuenta sin nombre puede agregar el primero', async () => {
    const api = stub(undefined, ok('Mateo'));
    renderApp();
    expect(await screen.findByText('Aún no tienes un nombre.')).toBeInTheDocument();
    const field = await openForm('Agregar nombre');
    expect(field).toHaveValue('');
    type(field, 'Mateo');
    save();

    expect(await screen.findByText(/Listo: tu nombre ahora es Mateo/)).toBeVisible();
    expect(JSON.parse(patches(api)[0]?.body ?? '{}')).toEqual({ displayName: 'Mateo' });
    expect(screen.getByRole('heading', { name: 'Hola, Mateo' })).toBeVisible();
  });

  it('un nombre que no cumple las reglas del registro no se envía y se marca en el campo', async () => {
    const api = stub('Sara');
    renderApp();
    const field = await openForm();
    type(field, 'Sara 2');
    save();

    const message = await screen.findByText(/de 2 a 40 letras, sin números ni símbolos/);
    expect(message).toHaveAttribute('role', 'alert');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.getAttribute('aria-describedby')).toContain(message.id);
    await waitFor(() => {
      expect(field).toHaveFocus();
    });
    expect(patches(api)).toHaveLength(0);
  });

  it('un 400 del servidor sale junto al campo, que sigue abierto, sin su nombre técnico', async () => {
    stub('Sara', invalid());
    renderApp();
    const field = await openForm();
    type(field, 'Ana');
    save();

    const message = await screen.findByText(
      'Escribe tu nombre: de 2 a 40 letras, sin números ni símbolos.',
    );
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.getAttribute('aria-describedby')).toContain(message.id);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Hola, Sara' })).toBeVisible();
  });

  it('corregir el nombre quita el error', async () => {
    stub('Sara', invalid());
    renderApp();
    const field = await openForm();
    type(field, 'Ana');
    save();
    await screen.findByText('Escribe tu nombre: de 2 a 40 letras, sin números ni símbolos.');
    type(field, 'Anita');
    expect(
      screen.queryByText('Escribe tu nombre: de 2 a 40 letras, sin números ni símbolos.'),
    ).toBeNull();
    expect(field).not.toHaveAttribute('aria-invalid');
  });

  it('un 429 explica cuánto esperar y deja volver a intentar', async () => {
    stub('Sara', {
      status: 429,
      headers: { 'Retry-After': '90' },
      body: { code: 'TOO_MANY_REQUESTS', message: 'x' },
    });
    renderApp();
    type(await openForm(), 'Ana');
    save();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cambiaste tu nombre demasiadas veces. Espera 90 segundos.',
    );
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('sin red avisa y el botón no se queda bloqueado', async () => {
    stub('Sara');
    renderApp();
    const field = await openForm();
    type(field, 'Ana');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    save();

    expect(await screen.findByText(/No hay conexión con Valora/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(field).toHaveValue('Ana');
  });

  it('con otro error del servidor muestra su mensaje', async () => {
    stub('Sara', { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Falló el servidor.' } });
    renderApp();
    type(await openForm(), 'Ana');
    save();
    expect(await screen.findByText('Falló el servidor.')).toBeInTheDocument();
  });

  it('Cancelar cierra sin enviar, descarta lo escrito y devuelve el foco al botón', async () => {
    const api = stub('Sara');
    renderApp();
    type(await openForm(), 'Otra');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    const button = screen.getByRole('button', { name: 'Cambiar nombre' });
    expect(button).toHaveFocus();
    expect(patches(api)).toHaveLength(0);
    fireEvent.click(button);
    expect(screen.getByLabelText('Tu nombre')).toHaveValue('Sara');
  });

  it('con el teclado, Escape cancela y enviar el formulario (Enter) guarda', async () => {
    const api = stub('Sara', ok('Ana'));
    renderApp();
    const field = await openForm();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Cambiar nombre' })).toHaveFocus();

    const again = await openForm();
    type(again, 'Ana');
    fireEvent.submit(again.closest('form') as HTMLFormElement);
    expect(await screen.findByText(/tu nombre ahora es Ana/)).toBeVisible();
    expect(patches(api)).toHaveLength(1);
  });

  it('un nuevo envío mientras se guarda no repite la llamada', async () => {
    const api = stub('Sara', { status: 200, pending: true });
    renderApp();
    const field = await openForm();
    type(field, 'Ana');
    const form = field.closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await screen.findByRole('button', { name: 'Guardando…' });
    expect(patches(api)).toHaveLength(1);
  });

  it('el aviso de éxito se quita al abrir de nuevo', async () => {
    stub('Sara', ok('Ana'));
    renderApp();
    type(await openForm(), 'Ana');
    save();
    await screen.findByText(/Listo: tu nombre ahora es Ana/);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar nombre' }));
    expect(screen.queryByText(/Listo: tu nombre/)).toBeNull();
  });

  it('no tiene fallas graves de accesibilidad con el formulario abierto y con error', async () => {
    stub('Sara', invalid());
    const { container } = renderApp();
    type(await openForm(), 'Ana');
    save();
    await screen.findByText('Escribe tu nombre: de 2 a 40 letras, sin números ni símbolos.');
    let found: string[] = [];
    await act(async () => {
      found = await seriousViolations(container);
    });
    expect(found).toEqual([]);
  });
});
