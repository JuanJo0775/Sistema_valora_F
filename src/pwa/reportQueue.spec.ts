import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openReportQueue } from './reportQueue';

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
});
