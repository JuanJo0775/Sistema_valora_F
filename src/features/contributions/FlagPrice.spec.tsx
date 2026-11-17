import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, NO_SESSION, sessionAs, stubApi } from '../../test/fakeApi';
import { SessionProvider } from '../auth/SessionProvider';
import { FlagPrice } from './FlagPrice';

const REPORT = '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918';

const renderFlag = (session: FakeReply, flag: FakeReply = { status: 202 }) => {
  const api = stubApi({
    'GET /v1/auth/session': session,
    [`POST /v1/reports/${REPORT}/flag`]: flag,
  });
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/productos/arroz/comparar']}>
        <FlagPrice reportId={REPORT} storeName="Ara" />
      </MemoryRouter>
    </SessionProvider>,
  );
  return api;
};

const flag = async (reason: string, comment = '') => {
  fireEvent.click(await screen.findByRole('button', { name: '¿Este precio está mal?' }));
  fireEvent.click(screen.getByRole('radio', { name: reason }));
  if (comment)
    fireEvent.change(screen.getByLabelText('Comentario (opcional)'), {
      target: { value: comment },
    });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
};

describe('marcar un precio como dudoso', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('un reportante elige el motivo, lo envía y se le agradece', async () => {
    const api = renderFlag(sessionAs('reportante'));

    await flag('El precio es falso', 'En la góndola dice $5.000');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Gracias: lo revisará un moderador.',
    );
    const sent = api.calls.find(({ method }) => method === 'POST');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({
      reason: 'precio_falso',
      comment: 'En la góndola dice $5.000',
    });
  });

  it('si ya lo había marcado, lo dice', async () => {
    renderFlag(sessionAs('reportante'), {
      status: 409,
      body: { code: 'ALREADY_FLAGGED', message: 'Esta cuenta ya marcó este reporte.' },
    });

    await flag('No es esta tienda');

    expect(await screen.findByRole('status')).toHaveTextContent('Ya marcaste este precio.');
  });

  it('con la cuenta suspendida explica por qué no puede marcarlo y lleva a sus aportes', async () => {
    renderFlag(sessionAs('reportante'), {
      status: 403,
      body: { code: 'ACCOUNT_SUSPENDED', message: 'La cuenta está suspendida.' },
    });

    await flag('El precio es falso');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu cuenta está suspendida: por ahora no puedes marcar precios.',
    );
    expect(screen.getByRole('link', { name: 'Ver mis aportes' })).toHaveAttribute(
      'href',
      '/mis-aportes',
    );
  });

  it('sin sesión lleva a entrar y vuelve a la misma pantalla', async () => {
    renderFlag(NO_SESSION);

    expect(await screen.findByRole('link', { name: '¿Este precio está mal?' })).toHaveAttribute(
      'href',
      '/entrar?volver=%2Fproductos%2Farroz%2Fcomparar',
    );
  });

  it('un moderador no ve la opción (solo los reportantes marcan)', async () => {
    renderFlag(sessionAs('moderador'));

    await vi.waitFor(() => {
      expect(screen.queryByText('¿Este precio está mal?')).not.toBeInTheDocument();
    });
  });
});
