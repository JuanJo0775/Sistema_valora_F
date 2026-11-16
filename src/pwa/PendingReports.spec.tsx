import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, NO_SESSION, sessionAs, stubApi } from '../test/fakeApi';
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

const renderPending = (posts: FakeReply[], session: FakeReply = sessionAs('reportante')) => {
  stubApi({ 'GET /v1/auth/session': session, 'POST /v1/reports': posts });
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

  it('«Descartar» quita un reporte que requiere atención', async () => {
    await saveReports('Leche · 1 l');
    renderPending([
      { status: 422, body: { code: 'INVALID_OBSERVATION_DATE', message: 'Fuera de rango.' } },
    ]);

    fireEvent.click((await rowOf('Leche · 1 l')).getByRole('button', { name: 'Descartar' }));

    expect(
      await screen.findByRole('heading', { name: 'No tienes reportes guardados en este teléfono' }),
    ).toBeInTheDocument();
  });

  it('si falta la sesión pide iniciarla y vuelve aquí para enviarlos', async () => {
    await saveReports('Huevos · 12 und');
    renderPending(
      [{ status: 401, body: { code: 'UNAUTHORIZED', message: 'Se requiere sesión.' } }],
      NO_SESSION,
    );

    expect(
      await screen.findByRole('link', { name: 'Inicia sesión para enviarlos' }),
    ).toHaveAttribute('href', '/entrar?volver=%2Fpendientes');
  });

  it('con reportes por enviar avisa que puede hacer falta abrir la app', async () => {
    await saveReports('Huevos · 12 und');
    renderPending([{ status: 503, body: { code: 'REQUEST_ERROR', message: 'No disponible.' } }]);

    expect(
      await screen.findByText(
        'Se envían solos cuando hay conexión. Si no salen, abre Valora con internet: el navegador no siempre los envía con la app cerrada.',
      ),
    ).toBeInTheDocument();
  });
});
