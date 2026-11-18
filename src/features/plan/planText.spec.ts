import { describe, expect, it } from 'vitest';
import { directionsTo } from '../../shared/directions';
import { planToText } from './planText';
import { toSavedPlan, type PlanDraft, type SavedPlan } from './savedPlan';

// 17-nov-2026 a las 21:30 en Colombia (UTC-5): el día en UTC ya sería el 18.
const NOW = new Date('2026-11-18T02:30:00Z');

const draft = (): PlanDraft => ({
  area: { kind: 'ubicacion', radiusKm: 1.5, lat: 4.5339, lng: -75.6811 },
  stores: [
    {
      id: 's1',
      name: 'D1 Calle 50',
      type: 'descuento',
      address: 'Cl. 50 # 14-20',
      lat: 4.53,
      lng: -75.68,
      municipality: 'armenia',
      distanceM: 812,
      delivery: { feeCop: 5000 },
    },
    {
      id: 's2',
      name: 'Tienda Don Pepe',
      type: 'barrio',
      lat: 4.54,
      lng: -75.69,
      municipality: 'armenia',
      distanceM: 400,
      delivery: null,
    },
  ],
  lines: [
    {
      productId: 'p1',
      productName: 'Arroz blanco',
      presentationId: 'pr1',
      presentationLabel: 'Diana · 500 g',
      quantity: 2,
      storeId: 's1',
      priceCop: 2190,
      source: 'siembra',
      freshness: 'vigente',
      observedAt: '2026-11-16T15:00:00Z',
    },
    {
      productId: 'p2',
      productName: 'Aceite',
      presentationId: 'pr2',
      presentationLabel: '1 L',
      quantity: 1,
      storeId: 's2',
      priceCop: 9000,
      source: 'comunidad',
      freshness: 'vigente',
      observedAt: '2026-11-15T15:00:00Z',
    },
    {
      productId: 'p3',
      productName: 'Sal marina',
      presentationId: 'pr3',
      presentationLabel: '500 g',
      quantity: 1,
      storeId: null,
      priceCop: null,
      source: 'comunidad',
      freshness: 'vigente',
      observedAt: null,
    },
  ],
  summary: {
    stores: 2,
    productsCop: 13380,
    baselineCop: 15000,
    travel: {
      extraKm: 1.4,
      minutes: 19,
      costCop: null,
      assumptions: { detour: 1.3, kmh: 4.5, mode: 'none' },
    },
    deliveryCop: 5000,
    netCop: -3380,
    missing: 1,
  },
});

const plan = (): SavedPlan => toSavedPlan(draft(), NOW);

const DELIVERY_NOTE =
  'Valora no hace pedidos ni domicilios. La tarifa es la que tú escribiste; confírmala con la tienda.';

describe('planToText', () => {
  it('incluye por tienda nombre, dirección y enlace Cómo llegar', () => {
    const text = planToText(plan());
    expect(text).toContain('D1 Calle 50');
    expect(text).toContain('Cl. 50 # 14-20');
    expect(text).toContain(directionsTo({ lat: 4.53, lng: -75.68 }));
    expect(text).toContain(directionsTo({ lat: 4.54, lng: -75.69 }));
    expect(text).toContain('Cómo llegar');
  });

  it('sin dirección omite la línea y no deja undefined', () => {
    const text = planToText(plan());
    expect(text).toContain('Tienda Don Pepe');
    expect(text).not.toMatch(/undefined|null|NaN/);
    const lines = text.split('\n');
    const i = lines.findIndex((l) => l.includes('Tienda Don Pepe'));
    expect(lines[i + 1]).toContain('Cómo llegar');
  });

  it('lista productos con cantidad, precio y fecha del precio, y subtotal', () => {
    const text = planToText(plan());
    expect(text).toContain('Arroz blanco');
    expect(text).toContain('Diana · 500 g');
    expect(text).toMatch(/2 x .*\$\s?2\.190/);
    expect(text).toContain('16-nov');
    expect(text).toContain('15-nov');
    expect(text).toMatch(/Subtotal.*\$\s?4\.380/);
    expect(text).toMatch(/Subtotal.*\$\s?9\.000/);
  });

  it('da la fecha de guardado en hora de Colombia', () => {
    expect(planToText(plan())).toContain('Plan guardado el 17-nov');
  });

  it('muestra totales y marca traslado y domicilio como estimado', () => {
    const text = planToText(plan());
    expect(text).toMatch(/Total productos.*\$\s?13\.380/);
    expect(text).toMatch(/Traslado \(estimado\)/);
    expect(text).toContain('1,4 km');
    expect(text).toContain('19 min');
    expect(text).toMatch(/Domicilio \(estimado\).*\$\s?5\.000/);
    expect(text).toContain(DELIVERY_NOTE);
  });

  it('el domicilio de la tienda se rotula estimado', () => {
    expect(planToText(plan())).toMatch(/D1 Calle 50[\s\S]*Domicilio \(estimado\)/);
  });

  it('sin domicilio ni traslado no los menciona ni pone la nota', () => {
    const d = draft();
    d.stores = d.stores.map((s) => ({ ...s, delivery: null }));
    d.summary = { ...d.summary, travel: null, deliveryCop: 0 };
    const text = planToText(toSavedPlan(d, NOW));
    expect(text).not.toContain('Domicilio');
    expect(text).not.toContain('Traslado');
    expect(text).not.toContain(DELIVERY_NOTE);
  });

  it('lista aparte los productos sin precio vigente', () => {
    const text = planToText(plan());
    expect(text).toMatch(/Sin precio vigente[\s\S]*Sal marina/);
    const before = text.slice(0, text.indexOf('Sin precio vigente'));
    expect(before).not.toContain('Sal marina');
  });

  it('termina con la línea de precios informativos', () => {
    const text = planToText(plan()).trimEnd();
    expect(text.split('\n').at(-1)).toBe('Precios informativos de Valora, no oficiales');
  });

  it('no contiene distanceM ni las coordenadas de la persona', () => {
    const text = planToText(plan());
    expect(text).not.toContain('distanceM');
    expect(text).not.toContain('4.5339');
    expect(text).not.toContain('-75.6811');
    expect(text).not.toContain('812');
  });
});
