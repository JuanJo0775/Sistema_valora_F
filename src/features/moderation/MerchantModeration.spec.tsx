import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { sessionAs, stubApi } from '../../test/fakeApi';
import { SessionProvider } from '../auth/SessionProvider';
import { MerchantReport } from '../stores/MerchantReport';
import { ModerationPanel } from './ModerationPanel';

vi.mock('../stores/StoreMap', () => ({ StoreMap: () => null }));

afterEach(() => {
  vi.unstubAllGlobals();
});

it('ofrece denunciar solo si la API autoriza y envía el motivo', async () => {
  const path = '/v1/establishments/s1/merchant-reports';
  const { calls } = stubApi({
    'GET /v1/auth/session': sessionAs('reportante'),
    [`GET ${path}`]: { status: 200, body: { canReport: true } },
    [`POST ${path}`]: { status: 202, body: { status: 'pendiente' } },
  });
  render(
    <MemoryRouter>
      <SessionProvider>
        <MerchantReport establishmentId="s1" />
      </SessionProvider>
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: '¿Este comercio no es de quien dice?' }),
  );
  // El botón que abrió el formulario desaparece: el foco pasa al campo del motivo.
  expect(screen.getByLabelText('Motivo de la denuncia')).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Motivo de la denuncia'), {
    target: { value: 'La tienda tiene otro dueño.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar denuncia' }));
  expect(
    await screen.findByText('Denuncia recibida. Un moderador revisará el caso.'),
  ).toHaveFocus();
  expect(calls.find((request) => request.method === 'POST')?.body).toBe(
    JSON.stringify({ reason: 'La tienda tiene otro dueño.' }),
  );
});

it('no habilita la denuncia al consultar una tienda propia', async () => {
  const requested = vi.fn(() => ({ status: 200, body: { canReport: false } }));
  stubApi({
    'GET /v1/auth/session': sessionAs('comercio'),
    'GET /v1/establishments/s1/merchant-reports': requested,
  });
  render(
    <MemoryRouter>
      <SessionProvider>
        <MerchantReport establishmentId="s1" />
      </SessionProvider>
    </MemoryRouter>,
  );
  await vi.waitFor(() => {
    expect(requested).toHaveBeenCalled();
  });
  expect(
    screen.queryByRole('button', { name: '¿Este comercio no es de quien dice?' }),
  ).not.toBeInTheDocument();
});

it('permite al moderador revocar un comercio con motivo', async () => {
  const path = '/v1/moderation/merchant-cases';
  const { calls } = stubApi({
    'GET /v1/auth/session': sessionAs('moderador'),
    [`GET ${path}`]: {
      status: 200,
      body: {
        items: [
          {
            id: 'c1',
            kind: 'denuncia',
            establishment: { id: 's1', name: 'La Rosa' },
            owner: null,
            reason: 'El dueño no coincide.',
            createdAt: '2026-11-22T12:00:00Z',
          },
        ],
      },
    },
    [`POST ${path}/c1/decision`]: { status: 204 },
  });
  render(
    <MemoryRouter initialEntries={['/moderacion?vista=comercios']}>
      <ModerationPanel />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('radio', { name: 'Revocar comercio' }));
  fireEvent.change(screen.getByLabelText('Motivo de la decisión'), {
    target: { value: 'Motivo verificado por moderación.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar decisión' }));
  expect(await screen.findByText('Decisión registrada: La Rosa.')).toBeInTheDocument();
  expect(calls.find((request) => request.path.endsWith('/c1/decision'))?.body).toBe(
    JSON.stringify({ decision: 'revocar', note: 'Motivo verificado por moderación.' }),
  );
});

it('permite aprobar una corrección en Tiendas y muestra los cambios propuestos', async () => {
  const path = '/v1/moderation/store-proposals';
  const { calls } = stubApi({
    'GET /v1/auth/session': sessionAs('moderador'),
    [`GET ${path}`]: {
      status: 200,
      body: {
        items: [
          {
            id: 'q1',
            kind: 'correccion',
            establishmentId: 's1',
            current: { name: 'La Rosa', lat: 4.53, lng: -75.68 },
            proposed: { name: 'La Rosa Centro', lat: 4.54, lng: -75.68 },
            possibleDuplicates: [],
            createdAt: '2026-11-22T12:00:00Z',
          },
        ],
      },
    },
    [`POST ${path}/q1/decision`]: { status: 204 },
  });
  render(
    <MemoryRouter initialEntries={['/moderacion?vista=tiendas']}>
      <ModerationPanel />
    </MemoryRouter>,
  );
  const panel = screen.getByRole('tabpanel', { name: 'Tiendas' });
  expect(
    await within(panel).findByText(/Nombre actual: La Rosa · Propuesto: La Rosa Centro/),
  ).toBeInTheDocument();
  expect(within(panel).getByText(/Ubicación propuesta/)).toBeInTheDocument();
  expect(within(panel).queryByRole('radio', { name: /Fusionar/ })).not.toBeInTheDocument();
  fireEvent.click(within(panel).getByRole('radio', { name: 'Aprobar corrección' }));
  fireEvent.change(within(panel).getByLabelText('Motivo de la decisión'), {
    target: { value: 'Confirmado en la visita.' },
  });
  fireEvent.click(within(panel).getByRole('button', { name: 'Registrar decisión' }));
  expect(await within(panel).findByText('Decisión registrada: La Rosa.')).toBeInTheDocument();
  expect(calls.find((request) => request.path.endsWith('/q1/decision'))?.body).toBe(
    JSON.stringify({ decision: 'aprobar', note: 'Confirmado en la visita.' }),
  );
});

it('permite cancelar la denuncia y reintentar si el envío falla', async () => {
  stubApi({
    'GET /v1/auth/session': sessionAs('reportante'),
    'GET /v1/establishments/s1/merchant-reports': { status: 200, body: { canReport: true } },
    'POST /v1/establishments/s1/merchant-reports': [{ status: 503 }, { status: 202 }],
  });
  render(
    <MemoryRouter>
      <SessionProvider>
        <MerchantReport establishmentId="s1" />
      </SessionProvider>
    </MemoryRouter>,
  );
  const action = '¿Este comercio no es de quien dice?';
  fireEvent.click(await screen.findByRole('button', { name: action }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(screen.getByRole('button', { name: action }));
  const send = screen.getByRole('button', { name: 'Enviar denuncia' });
  expect(send).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Motivo de la denuncia'), {
    target: { value: '  La tienda tiene otro dueño.  ' },
  });
  fireEvent.click(send);
  await screen.findByRole('alert');
  expect(send).toBeEnabled();
  fireEvent.click(send);
  expect(await screen.findByText(/Denuncia recibida/)).toBeInTheDocument();
});
