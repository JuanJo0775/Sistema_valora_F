import { describe, expect, it } from 'vitest';
import type { components } from '../../shared/api/schema';
import { totalsByStore } from './totals';

type Offer = components['schemas']['ComparisonItem'];

const store = (id: string, name: string) => ({
  id,
  name,
  type: 'barrio' as const,
  lat: 4.53,
  lng: -75.68,
  municipality: 'armenia' as const,
});
const ara = store('a', 'Ara');

const offer = (where: typeof ara, presentationId: string, priceCop: number): Offer => ({
  establishment: where,
  reportId: `${where.id}-${presentationId}`,
  presentationId,
  priceCop,
  unitPrice: { valueCop: priceCop, per: 'und' },
  source: 'comunidad',
  freshness: 'vigente',
  reliability: 'alta',
  confirmations: 1,
  isCheapest: false,
  observedAt: '2026-11-16T15:00:00Z',
});

describe('total de la canasta por tienda', () => {
  it('suma el precio de cada presentación por su cantidad: 2 arroz de $2.500 y 1 leche de $4.000 son $9.000', () => {
    const [total] = totalsByStore([
      { presentationId: 'arroz-500g', quantity: 2, offers: [offer(ara, 'arroz-500g', 2500)] },
      { presentationId: 'leche-1l', quantity: 1, offers: [offer(ara, 'leche-1l', 4000)] },
    ]);

    expect(total).toMatchObject({ store: ara, totalCop: 9000, found: 2, complete: true });
  });
});
