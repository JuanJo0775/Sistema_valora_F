import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi } from '../../test/fakeApi';
import { RoleChange } from './RoleChange';

const renderRoles = (reply: FakeReply) => {
  const api = stubApi({
    'GET /v1/auth/session': sessionAs('moderador'),
    'POST /v1/moderation/roles': reply,
  });
  render(<RoleChange />);
  return api;
};

const fill = ({
  email = 'ana@ejemplo.co',
  role = 'moderador',
  note = 'Lleva meses aportando bien.',
}) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Correo de la cuenta' }), {
    target: { value: email },
  });
  fireEvent.click(
    screen.getByRole('radio', { name: role === 'moderador' ? 'Moderador' : 'Reportante' }),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Motivo del cambio' }), {
    target: { value: note },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar rol' }));
};

describe('cambiar el rol de una cuenta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía el correo, el rol nuevo y el motivo, y confirma el cambio', async () => {
    const api = renderRoles({ status: 204 });

    fill({});

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Listo: ana@ejemplo.co ahora es moderador.',
    );
    const sent = api.calls.find(({ method }) => method === 'POST');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({
      email: 'ana@ejemplo.co',
      role: 'moderador',
      note: 'Lleva meses aportando bien.',
    });
    expect(screen.getByRole('textbox', { name: 'Correo de la cuenta' })).toHaveValue('');
  });

  it('sin un correo válido dice qué falta y no envía', () => {
    const api = renderRoles({ status: 204 });

    fill({ email: 'ana' });

    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el correo de la cuenta.');
    expect(api.calls.some(({ method }) => method === 'POST')).toBe(false);
  });

  it('sin un motivo de al menos 10 letras dice qué falta y no envía', () => {
    const api = renderRoles({ status: 204 });

    fill({ note: 'porque sí' });

    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el motivo: al menos 10 letras.');
    expect(api.calls.some(({ method }) => method === 'POST')).toBe(false);
  });

  it.each([
    [409, 'OWN_ROLE', 'No puedes cambiar tu propio rol: lo cambia otro moderador.'],
    [409, 'ROLE_UNCHANGED', 'Esa cuenta ya tiene ese rol.'],
    [404, 'NOT_FOUND', 'Ninguna cuenta tiene ese correo.'],
  ])('si el servidor responde %i %s, lo explica', async (status, code, message) => {
    renderRoles({ status, body: { code, message: 'Rechazado.' } });

    fill({});

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('después de muchos cambios seguidos dice cuánto esperar', async () => {
    renderRoles({
      status: 429,
      body: { code: 'RATE_LIMITED', message: 'Demasiados cambios.' },
      headers: { 'Retry-After': '300' },
    });

    fill({});

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hiciste muchos cambios seguidos. Inténtalo de nuevo en 5 minutos.',
    );
  });
});
