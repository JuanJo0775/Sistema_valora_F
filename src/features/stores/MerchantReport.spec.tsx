import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionAs, stubApi } from '../../test/fakeApi';
import { SessionProvider } from '../auth/SessionProvider';
import { MerchantReport } from './MerchantReport';

const STORE = '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d';

describe('denuncia de un comercio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explica el mínimo del motivo mientras el botón está desactivado', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('comercio'),
      [`GET /v1/establishments/${STORE}/merchant-reports`]: {
        status: 200,
        body: { canReport: true },
      },
    });
    render(
      <SessionProvider>
        <MerchantReport establishmentId={STORE} />
      </SessionProvider>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: '¿Este comercio no es de quien dice?' }),
    );
    const send = screen.getByRole('button', { name: 'Enviar denuncia' });
    expect(send).toBeDisabled();
    expect(screen.getByText(/al menos 10 letras/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Motivo de la denuncia'), {
      target: { value: 'Esta cuenta no es la dueña' },
    });
    expect(send).toBeEnabled();
    expect(screen.queryByText(/al menos 10 letras/)).not.toBeInTheDocument();
  });
});
