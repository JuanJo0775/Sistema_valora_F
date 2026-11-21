import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSUMPTIONS,
  extraTravel,
  haversineM,
  netEstimate,
  routeEstimate,
  type TravelAssumptions,
} from './travel';

const O = { lat: 0, lng: 0 };
const A = { lat: 0, lng: 0.01 };
const B = { lat: 0, lng: 0.02 };
const fare = (fareCop: number): TravelAssumptions => ({
  ...DEFAULT_ASSUMPTIONS,
  mode: 'fare',
  fareCop,
});

describe('haversineM', () => {
  it('mide 556 m entre dos puntos a 0,005 grados de latitud', () => {
    const d = haversineM({ lat: 4.5339, lng: -75.6811 }, { lat: 4.5389, lng: -75.6811 });
    expect(d).toBeCloseTo(556, 0);
  });

  it('entre un punto y él mismo es 0', () => {
    expect(haversineM(A, A)).toBe(0);
  });
});

describe('supuestos por defecto', () => {
  it('son rodeo 1,3, 4,5 km/h y sin costo en pesos', () => {
    expect(DEFAULT_ASSUMPTIONS).toEqual({ detour: 1.3, kmh: 4.5, mode: 'none' });
  });
});

describe('routeEstimate', () => {
  it('con origen elige el mejor orden, ida y vuelta, con rodeo', () => {
    // Se pasan en el peor orden: la ruta debe medir igual.
    const r = routeEstimate(O, [B, A], DEFAULT_ASSUMPTIONS);
    expect(r.km).toBeCloseTo(5.78, 1);
    expect(r.minutes).toBe(77);
    expect(r.costCop).toBeNull();
  });

  it('con pasaje cuenta un tramo por cada parada más la vuelta', () => {
    expect(routeEstimate(O, [A], fare(2500)).costCop).toBe(5000);
    expect(routeEstimate(O, [A, B], fare(2500)).costCop).toBe(7500);
  });

  it('el traslado extra de 2 tiendas frente a 1 cuesta un pasaje', () => {
    const a = fare(2500);
    const extra = extraTravel(routeEstimate(O, [A, B], a), routeEstimate(O, [A], a));
    expect(extra.costCop).toBe(2500);
  });

  it('con costo por km multiplica los km y redondea', () => {
    const a: TravelAssumptions = { ...DEFAULT_ASSUMPTIONS, mode: 'perKm', perKmCop: 800 };
    const r = routeEstimate(O, [A, B], a);
    expect(r.costCop).toBe(Math.round(r.km * 800));
  });

  it('en modo pasaje o por km sin valor escrito no inventa pesos', () => {
    expect(routeEstimate(O, [A], { ...DEFAULT_ASSUMPTIONS, mode: 'fare' }).costCop).toBeNull();
    expect(routeEstimate(O, [A], { ...DEFAULT_ASSUMPTIONS, mode: 'perKm' }).costCop).toBeNull();
  });

  it('sin origen mide solo la distancia entre las tiendas y cuenta 1 tramo', () => {
    const r = routeEstimate(null, [A, B], fare(2500));
    expect(r.km).toBeCloseTo(1.112 * 1.3, 2);
    expect(r.costCop).toBe(2500);
  });

  it('sin origen y con una sola tienda no hay trayecto', () => {
    expect(routeEstimate(null, [A], fare(2500))).toEqual({ km: 0, minutes: 0, costCop: 0 });
  });

  it('sin paradas no hay trayecto', () => {
    expect(routeEstimate(O, [], DEFAULT_ASSUMPTIONS)).toEqual({ km: 0, minutes: 0, costCop: null });
  });

  it('con 3 tiendas y origen prueba todos los órdenes sin fallar', () => {
    const C = { lat: 0.01, lng: 0.01 };
    const r = routeEstimate(O, [C, B, A], DEFAULT_ASSUMPTIONS);
    expect(r.km).toBeGreaterThan(0);
  });
});

describe('extraTravel', () => {
  it('resta km y minutos', () => {
    const extra = extraTravel(
      { km: 5, minutes: 60, costCop: null },
      { km: 2, minutes: 25, costCop: null },
    );
    expect(extra).toEqual({ km: 3, minutes: 35, costCop: null });
  });

  it('si cualquiera no tiene costo, el extra no tiene costo', () => {
    expect(
      extraTravel({ km: 5, minutes: 60, costCop: 100 }, { km: 2, minutes: 25, costCop: null })
        .costCop,
    ).toBeNull();
    expect(
      extraTravel({ km: 5, minutes: 60, costCop: null }, { km: 2, minutes: 25, costCop: 100 })
        .costCop,
    ).toBeNull();
  });
});

describe('netEstimate', () => {
  it('ahorro menos traslado y domicilio', () => {
    expect(
      netEstimate({ productsCop: 84300, baselineCop: 90500, travelExtraCop: 0, deliveryCop: 5000 }),
    ).toEqual({ savingsCop: 6200, netCop: 1200 });
  });

  it('sin línea base no hay ahorro ni neto', () => {
    expect(
      netEstimate({ productsCop: 84300, baselineCop: null, travelExtraCop: 0, deliveryCop: 5000 }),
    ).toEqual({ savingsCop: null, netCop: null });
  });

  it('sin costo de traslado el neto no lo resta', () => {
    expect(
      netEstimate({
        productsCop: 84300,
        baselineCop: 90500,
        travelExtraCop: null,
        deliveryCop: 5000,
      }),
    ).toEqual({ savingsCop: 6200, netCop: 1200 });
  });
});
