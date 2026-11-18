import type { Point } from '../../shared/location';

// Traslado estimado del plan: distancias en línea recta con un factor de rodeo, minutos a pie y
// pesos solo si la persona escribió su pasaje o su costo por km. Nada se guarda ni se inventa.
const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Distancia en línea recta entre dos puntos (Haversine), en metros.
export const haversineM = (a: Point, b: Point): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

export interface TravelAssumptions {
  detour: number; // las calles no van en línea recta
  kmh: number; // velocidad a pie
  mode: 'none' | 'fare' | 'perKm';
  fareCop?: number; // pasaje por tramo, escrito por la persona
  perKmCop?: number; // costo por km, escrito por la persona
}

export const DEFAULT_ASSUMPTIONS: TravelAssumptions = { detour: 1.3, kmh: 4.5, mode: 'none' };

export interface TravelEstimate {
  km: number;
  minutes: number;
  costCop: number | null;
}

// Todos los órdenes posibles de visita (a lo sumo 3 paradas en el plan: 6 órdenes).
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

// Largo en metros de un recorrido: con origen es ida y vuelta; sin origen, camino abierto.
function pathM(origin: Point | null, order: Point[]): number {
  const path = origin ? [origin, ...order, origin] : order;
  return path.slice(1).reduce((total, point, i) => total + haversineM(path[i] ?? point, point), 0);
}

export function routeEstimate(
  origin: Point | null,
  stops: Point[],
  a: TravelAssumptions,
): TravelEstimate {
  // Tramos: con origen, una ida a cada parada más la vuelta; sin origen, solo entre tiendas.
  const legs = stops.length === 0 ? 0 : origin ? stops.length + 1 : stops.length - 1;
  const meters = Math.min(...permutations(stops).map((order) => pathM(origin, order)));
  const km = (stops.length === 0 ? 0 : meters / 1000) * a.detour;
  const minutes = Math.round((km / a.kmh) * 60);
  let costCop: number | null = null;
  if (a.mode === 'fare' && a.fareCop !== undefined) costCop = legs * a.fareCop;
  else if (a.mode === 'perKm' && a.perKmCop !== undefined) costCop = Math.round(km * a.perKmCop);
  return { km, minutes, costCop };
}

// Lo que el plan agrega frente a la línea base; sin costo en cualquiera de los dos, sin costo.
export const extraTravel = (route: TravelEstimate, baseline: TravelEstimate): TravelEstimate => ({
  km: route.km - baseline.km,
  minutes: route.minutes - baseline.minutes,
  costCop:
    route.costCop === null || baseline.costCop === null ? null : route.costCop - baseline.costCop,
});

// El traslado que se muestra y se guarda: una sola decisión para la pantalla y el plan guardado.
// extra: lo que suma dividir frente a ir a la mejor tienda única; menos: dividir (con domicilio)
// deja menos traslado que eso, en valores absolutos; total: el viaje completo (1 tienda, o ninguna
// tienda sola cubre todo y no hay con qué comparar). Nunca un número negativo rotulado «extra».
export interface ShownTravel extends TravelEstimate {
  kind: 'extra' | 'menos' | 'total';
}

export function shownTravel(
  split: boolean,
  route: TravelEstimate,
  extra: TravelEstimate | null,
): ShownTravel {
  if (!split || extra === null) return { ...route, kind: 'total' };
  if (extra.km < 0) {
    return {
      km: -extra.km,
      minutes: Math.abs(extra.minutes),
      costCop: extra.costCop === null ? null : Math.abs(extra.costCop),
      kind: 'menos',
    };
  }
  return {
    ...extra,
    minutes: Math.max(0, extra.minutes),
    // Un costo negativo con más kilómetros no se rotula «extra».
    costCop: extra.costCop !== null && extra.costCop < 0 ? null : extra.costCop,
    kind: 'extra',
  };
}

// Ahorro frente a la mejor tienda única y neto tras traslado y domicilio. El traslado sin costo
// escrito no se resta (la pantalla lo dice).
export function netEstimate(i: {
  productsCop: number;
  baselineCop: number | null;
  travelExtraCop: number | null;
  deliveryCop: number;
}): { savingsCop: number | null; netCop: number | null } {
  if (i.baselineCop === null) return { savingsCop: null, netCop: null };
  const savingsCop = i.baselineCop - i.productsCop;
  return { savingsCop, netCop: savingsCop - (i.travelExtraCop ?? 0) - i.deliveryCop };
}
