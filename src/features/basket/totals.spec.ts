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
const d1 = store('d', 'D1');
const exito = store('e', 'Éxito');

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

  it('solo cuenta la presentación elegida: si la tienda tiene 1 kg y pediste 500 g, no lo tiene', () => {
    const [total] = totalsByStore([
      { presentationId: 'arroz-500g', quantity: 1, offers: [offer(ara, 'arroz-1kg', 4800)] },
    ]);

    expect(total).toBeUndefined();
  });

  it('una tienda a la que le falta un producto dice cuántos tiene y no está completa', () => {
    const [total] = totalsByStore([
      { presentationId: 'arroz-500g', quantity: 1, offers: [offer(d1, 'arroz-500g', 2300)] },
      { presentationId: 'leche-1l', quantity: 1, offers: [] },
    ]);

    expect(total).toMatchObject({ store: d1, found: 1, complete: false });
  });

  it('primero las tiendas con todo, de la más barata a la más cara; luego las demás, por cuántos tienen', () => {
    const totals = totalsByStore([
      {
        presentationId: 'arroz-500g',
        quantity: 1,
        offers: [
          offer(ara, 'arroz-500g', 2600),
          offer(d1, 'arroz-500g', 2300),
          offer(exito, 'arroz-500g', 2400),
        ],
      },
      {
        presentationId: 'leche-1l',
        quantity: 1,
        offers: [offer(ara, 'leche-1l', 4000), offer(exito, 'leche-1l', 3900)],
      },
    ]);

    expect(totals.map(({ store: { name } }) => name)).toEqual(['Éxito', 'Ara', 'D1']);
  });
});
