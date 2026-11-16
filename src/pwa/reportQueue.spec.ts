import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../shared/api';
import { openReportQueue, type QueuedReport } from './reportQueue';

let dbCount = 0;
// Cada prueba usa su propia base, como si fuera otro teléfono.
const freshName = () => `valora-test-${String(++dbCount)}`;

const report = (key = '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918') => ({
  idempotencyKey: key,
  body: {
    presentationId: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b',
    establishmentId: '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
    priceCop: 2500,
    priceType: 'normal' as const,
    observedAt: '2026-11-16T15:00:00.000Z',
  },
  label: { product: 'Arroz blanco · 500 g', store: 'Tienda Don Pepe' },
});

// El envío a POST /v1/reports: responde bien o lanza el ApiError que llegaría del servidor.
const answers = (...replies: (ApiError | 'ok')[]) =>
  vi.fn<(report: QueuedReport) => Promise<void>>(() => {
    const reply = replies.shift() ?? 'ok';
    return reply === 'ok' ? Promise.resolve() : Promise.reject(reply);
  });

describe('cola de reportes sin conexión', () => {
  it('un reporte guardado queda pendiente, con su clave y su hora, aunque se cierre la app', async () => {
    const name = freshName();
    const queue = await openReportQueue(name);

    await queue.add(report());
    const reopened = await openReportQueue(name);

    const [saved] = await reopened.list();
    expect(saved).toMatchObject({
      idempotencyKey: '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918',
      status: 'pendiente',
      body: { observedAt: '2026-11-16T15:00:00.000Z' },
    });
  });

  it('con 201 o 200 queda sincronizado: se envió con su clave y su cuerpo y no se vuelve a enviar', async () => {
    const queue = await openReportQueue(freshName());
    await queue.add(report());
    const send = answers('ok');

    await queue.sync(send);
    await queue.sync(send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: report().idempotencyKey, body: report().body }),
    );
    const [synced] = await queue.list();
    expect(synced?.status).toBe('sincronizado');
    expect(synced?.syncedAt).toBeDefined();
  });

  it.each([
    ['sin red', new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Sin red.' })],
    ['con un 5xx', new ApiError({ status: 503, code: 'REQUEST_ERROR', message: 'No disponible.' })],
  ])('%s se queda pendiente y se reintenta después con la misma clave', async (_case, failure) => {
    const queue = await openReportQueue(freshName());
    await queue.add(report());
    const send = answers(failure, 'ok');

    await queue.sync(send);
    expect((await queue.list())[0]?.status).toBe('pendiente');
    await queue.sync(send);

    expect((await queue.list())[0]?.status).toBe('sincronizado');
    const keys = send.mock.calls.map(
      ([sent]) => (sent as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys).toEqual([report().idempotencyKey, report().idempotencyKey]);
  });

  it.each([
    [400, 'VALIDATION_ERROR'],
    [409, 'DUPLICATE_REPORT'],
    [422, 'INVALID_OBSERVATION_DATE'],
    [429, 'TOO_MANY_REQUESTS'],
  ])('con %i (%s) requiere atención: guarda por qué y no se reenvía', async (status, code) => {
    const queue = await openReportQueue(freshName());
    await queue.add(report());
    const failure = new ApiError({
      status,
      code,
      message: 'Motivo del servidor.',
      ...(code === 'DUPLICATE_REPORT' ? { availableFrom: '2026-11-16T15:30:00Z' } : {}),
    });
    const send = answers(failure);

    await queue.sync(send);
    await queue.sync(send);

    expect(send).toHaveBeenCalledTimes(1);
    const [saved] = await queue.list();
    expect(saved?.status).toBe('requiere_atencion');
    expect(saved?.problem).toMatchObject({ status, code, message: 'Motivo del servidor.' });
  });

  it('un reporte que requiere atención no detiene a los siguientes', async () => {
    const queue = await openReportQueue(freshName());
    await queue.add(report('11111111-1111-4111-8111-111111111111'));
    await queue.add(report('22222222-2222-4222-8222-222222222222'));
    const send = answers(
      new ApiError({ status: 409, code: 'DUPLICATE_REPORT', message: 'Repetido.' }),
      'ok',
    );

    await queue.sync(send);

    const statuses = (await queue.list()).map(({ status }) => status).sort();
    expect(statuses).toEqual(['requiere_atencion', 'sincronizado']);
  });
});
