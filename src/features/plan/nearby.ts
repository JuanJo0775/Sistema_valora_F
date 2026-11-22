import type { Point } from '../../shared/location';
import { type BasketLine, totalsByStore } from '../basket/totals';
import type { StoreTotals } from '../basket/useStoreTotals';
import { haversineM, hasLocation } from './travel';

// La cercanía se calcula en el dispositivo (ADR-031): la consulta es siempre por municipio, igual
// para todos, y la ubicación nunca sale del teléfono (EC-08). Estas funciones devuelven copias:
// la respuesta de la red, que está en memoria compartida, no se muta.

// Cada oferta con su distancia en línea recta a la persona. Sin coordenadas válidas no hay distancia.
export const withDistance = (lines: BasketLine[], origin: Point): BasketLine[] =>
  lines.map((line) => ({
    ...line,
    offers: line.offers.map((offer) => {
      const { establishment } = offer;
      if (!hasLocation(establishment)) return offer;
      const distanceM = Math.round(haversineM(origin, establishment));
      return { ...offer, establishment: { ...establishment, distanceM } };
    }),
  }));

// Solo las ofertas de tiendas a `radiusKm` o menos (las líneas ya traen `distanceM`).
export const withinRadius = (lines: BasketLine[], radiusKm: number): BasketLine[] =>
  lines.map((line) => ({
    ...line,
    offers: line.offers.filter(({ establishment }) => {
      const { distanceM } = establishment;
      return distanceM !== undefined && distanceM <= radiusKm * 1000;
    }),
  }));

// Las cuentas de la canasta como si el servidor hubiera buscado a la redonda: mismas tiendas y
// mismos totales que antes, pero hechos aquí con la respuesta por municipio. Sin ubicación, igual.
export function nearbyTotals(totals: StoreTotals, origin: Point | null, radiusKm: number) {
  if (!origin || totals.status !== 'ready') return totals;
  const lines = withinRadius(withDistance(totals.lines, origin), radiusKm);
  const all = totalsByStore(lines);
  const complete = all.filter(({ complete: whole }) => whole);
  return { ...totals, totals: all, best: complete[0], priciest: complete.at(-1), lines };
}
