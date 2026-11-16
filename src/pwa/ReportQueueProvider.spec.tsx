import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionAs, stubApi } from '../test/fakeApi';
import { useReportQueue } from './queueContext';
import { openReportQueue } from './reportQueue';
import { ReportQueueProvider } from './ReportQueueProvider';

const receipt = {
  id: '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918',
  status: 'recibido',
  receivedAt: '2026-11-16T15:00:00Z',
};

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
      observedAt: new Date().toISOString(),
    },
    label: { product: 'Arroz blanco · 500 g', store: 'Tienda Don Pepe' },
  });
};

// Lo que una pantalla ve de la cola.
function QueueStatus() {
  const { reports } = useReportQueue();
  return (
    <ul>
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
});
