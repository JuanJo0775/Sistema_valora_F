import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi } from '../../test/fakeApi';
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
});
