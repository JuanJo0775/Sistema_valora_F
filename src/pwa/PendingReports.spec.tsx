import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi } from '../test/fakeApi';
import { PendingReports } from './PendingReports';
import { openReportQueue } from './reportQueue';
import { ReportQueueProvider } from './ReportQueueProvider';

const receipt = {
  id: '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918',
  status: 'recibido',
  receivedAt: '2026-11-16T15:00:00Z',
};

// Tres reportes guardados en el teléfono, del más antiguo al más nuevo.
const saveReports = async (...products: string[]) => {
  const queue = await openReportQueue();
  for (const [index, product] of products.entries()) {
    await queue.add({
      idempotencyKey: `${String(index + 1).repeat(8)}-1111-4111-8111-111111111111`,
      body: {
        presentationId: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b',
        establishmentId: '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
        priceCop: 2500,
        priceType: 'normal',
        observedAt: new Date().toISOString(),
      },
      label: { product, store: 'Tienda Don Pepe' },
    });
    // savedAt distinto para que el orden de envío sea el de la lista.
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
};

const renderPending = (posts: FakeReply[]) => {
  stubApi({ 'GET /v1/auth/session': sessionAs('reportante'), 'POST /v1/reports': posts });
  return render(
    <ReportQueueProvider>
      <MemoryRouter>
        <PendingReports />
      </MemoryRouter>
    </ReportQueueProvider>,
  );
};

const rowOf = async (product: string) => {
  const name = await screen.findByText(product);
  return within(name.closest('li') as HTMLElement);
};

describe('reportes guardados en el teléfono', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra cada reporte con su tienda, su precio y su estado', async () => {
    await saveReports('Arroz · 500 g', 'Leche · 1 l', 'Huevos · 12 und');
    renderPending([
      { status: 201, body: receipt },
      {
        status: 409,
        body: {
          code: 'DUPLICATE_REPORT',
          message: 'Repetido.',
          availableFrom: '2026-11-16T15:30:00Z',
        },
      },
      { status: 503, body: { code: 'REQUEST_ERROR', message: 'No disponible.' } },
    ]);

    expect((await rowOf('Arroz · 500 g')).getByText('Enviado')).toBeInTheDocument();
    const milk = await rowOf('Leche · 1 l');
    expect(milk.getByText('Requiere atención')).toBeInTheDocument();
    expect(milk.getByText(/Podrás registrar otro precio desde las 10:30/)).toBeInTheDocument();
    const eggs = await rowOf('Huevos · 12 und');
    expect(eggs.getByText('Por enviar')).toBeInTheDocument();
    expect(eggs.getByText('Tienda Don Pepe · $2.500')).toBeInTheDocument();
  });
});
