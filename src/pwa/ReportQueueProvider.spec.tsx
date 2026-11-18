import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../features/auth/SessionProvider';
import { useSession } from '../features/auth/session';
import { NO_SESSION, sessionAs, stubApi } from '../test/fakeApi';
import { useReportQueue } from './queueContext';
import { openReportQueue } from './reportQueue';
import { ReportQueueProvider } from './ReportQueueProvider';

const receipt = {
  id: '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918',
  status: 'recibido',
  receivedAt: '2026-11-16T15:00:00Z',
};

const observedAtOfLeft = new Date().toISOString();

// Un reporte que quedó guardado en el teléfono la vez anterior.
const leftFromBefore = async () => {
  const queue = await openReportQueue();
  await queue.add({
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    body: {
      presentationId: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b',
      establishmentId: '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
      priceCop: 2500,
      priceType: 'normal',
      observedAt: observedAtOfLeft,
    },
    label: { product: 'Arroz blanco · 500 g', store: 'Tienda Don Pepe' },
  });
};

// Lo que una pantalla ve de la cola.
function QueueStatus() {
  const { reports, needsSession } = useReportQueue();
  return (
    <ul>
      {needsSession && <li>Falta iniciar sesión</li>}
      {reports.map((report) => (
        <li key={report.idempotencyKey}>{`${report.label.product}: ${report.status}`}</li>
      ))}
    </ul>
  );
}

const renderQueue = () =>
  render(
    <ReportQueueProvider>
      <QueueStatus />
    </ReportQueueProvider>,
  );

describe('sincronización de la cola', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('al abrir la app envía los reportes que quedaron pendientes', async () => {
    await leftFromBefore();
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/reports': { status: 201, body: receipt },
    });

    renderQueue();

    expect(await screen.findByText('Arroz blanco · 500 g: sincronizado')).toBeInTheDocument();
  });

  it('al volver la red reintenta los pendientes con la misma clave', async () => {
    await leftFromBefore();
    const api = stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/reports': [
        { status: 503, body: { code: 'REQUEST_ERROR', message: 'No disponible.' } },
        { status: 201, body: receipt },
      ],
    });
    renderQueue();
    expect(await screen.findByText('Arroz blanco · 500 g: pendiente')).toBeInTheDocument();

    fireEvent(window, new Event('online'));

    expect(await screen.findByText('Arroz blanco · 500 g: sincronizado')).toBeInTheDocument();
    const keys = api.calls
      .filter(({ method }) => method === 'POST')
      .map(({ headers }) => headers.get('Idempotency-Key'));
    expect(keys).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
    ]);
  });

  it('un 409 al reintentar de un reporte que el servidor ya tiene lo confirma, sin «requiere atención»', async () => {
    await leftFromBefore();
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/reports': {
        status: 409,
        body: { code: 'DUPLICATE_REPORT', message: 'Repetido.' },
      },
      'GET /v1/me/reports': {
        status: 200,
        body: {
          items: [
            {
              reportId: '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918',
              productId: '3b1f6f0e-6b7a-4c1d-9d5e-0a1b2c3d4e5f',
              productName: 'Arroz blanco · 500 g',
              establishmentName: 'Tienda Don Pepe',
              priceCop: 2500,
              priceType: 'normal',
              observedAt: observedAtOfLeft,
              status: 'normal',
            },
          ],
        },
      },
    });

    renderQueue();

    expect(await screen.findByText('Arroz blanco · 500 g: sincronizado')).toBeInTheDocument();
  });

  it('un 409 sin aporte igual en «Mis aportes» sí requiere atención', async () => {
    await leftFromBefore();
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/reports': {
        status: 409,
        body: { code: 'DUPLICATE_REPORT', message: 'Repetido.' },
      },
      'GET /v1/me/reports': { status: 200, body: { items: [] } },
    });

    renderQueue();

    expect(await screen.findByText('Arroz blanco · 500 g: requiere_atencion')).toBeInTheDocument();
  });

  it('si el servidor falla con la red arriba, reintenta cada 30 segundos mientras la app está abierta', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await leftFromBefore();
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'POST /v1/reports': [
        { status: 503, body: { code: 'REQUEST_ERROR', message: 'No disponible.' } },
        { status: 201, body: receipt },
      ],
    });
    renderQueue();
    expect(await screen.findByText('Arroz blanco · 500 g: pendiente')).toBeInTheDocument();

    vi.advanceTimersByTime(30_000);

    expect(await screen.findByText('Arroz blanco · 500 g: sincronizado')).toBeInTheDocument();
  });

  it('sin sesión espera y, al iniciar sesión, envía los pendientes', async () => {
    await leftFromBefore();
    let signedIn = false;
    stubApi({
      'GET /v1/auth/session': () => (signedIn ? sessionAs('reportante') : NO_SESSION),
      'POST /v1/auth/login': () => {
        signedIn = true;
        return { status: 204 };
      },
      'POST /v1/reports': [
        { status: 401, body: { code: 'UNAUTHORIZED', message: 'Se requiere sesión.' } },
        { status: 201, body: receipt },
      ],
    });
    function SignInButton() {
      const { signIn } = useSession();
      return (
        <button
          type="button"
          onClick={() => void signIn({ email: 'ana@correo.co', password: 'una clave larga' })}
        >
          Entrar
        </button>
      );
    }
    render(
      <SessionProvider>
        <ReportQueueProvider>
          <QueueStatus />
          <SignInButton />
        </ReportQueueProvider>
      </SessionProvider>,
    );
    expect(await screen.findByText('Falta iniciar sesión')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Arroz blanco · 500 g: sincronizado')).toBeInTheDocument();
    expect(screen.queryByText('Falta iniciar sesión')).not.toBeInTheDocument();
  });
});
