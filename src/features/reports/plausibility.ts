import type { components } from '../../shared/api/schema';

type Offer = components['schemas']['ComparisonItem'];

// EC-03: primera defensa, antes de enviar. PARÁMETROS PROVISIONALES: el servidor tendrá su propia
// regla de plausibilidad y estos números se ajustarán con ella. Están aquí, en un solo lugar.
export const PLAUSIBILITY = {
  // Atípico: menos de 40 % de la mediana (más de 60 % abajo)...
  lowRatio: 0.4,
  // ...o más de 250 % de la mediana (más de 150 % arriba).
  highRatio: 2.5,
  // Imposible: ningún producto de la canasta cuesta menos de $100; es un error de captura.
  minPricePesos: 100,
  // Mínimo de precios vigentes de la presentación para tener referencia.
  minOffers: 2,
  // Multiplicadores con los que se sugiere la corrección (faltaban ceros).
  suggestionFactors: [10, 100, 1000],
} as const;

export interface Reference {
  min: number;
  max: number;
  median: number;
  count: number;
}

// Solo los precios vigentes de esa presentación (los que el backend no manda a revisión).
export function referenceFrom(offers: Offer[], presentationId: string): Reference | null {
  const prices = offers
    .filter(
      (offer) =>
        offer.presentationId === presentationId &&
        offer.freshness === 'vigente' &&
        offer.reliability !== 'en_revision',
    )
    .map((offer) => offer.priceCop)
    .sort((a, b) => a - b);
  const first = prices[0];
  const last = prices.at(-1);
  if (first === undefined || last === undefined || prices.length < PLAUSIBILITY.minOffers) {
    return null;
  }
  const middle = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 1
      ? (prices[middle] ?? first)
      : Math.round(((prices[middle - 1] ?? first) + (prices[middle] ?? last)) / 2);
  return { min: first, max: last, median, count: prices.length };
}

export type Plausibility = 'ok' | 'imposible' | 'atipico';

export function judgePrice(pesos: number, reference: Reference | null): Plausibility {
  if (pesos < PLAUSIBILITY.minPricePesos) return 'imposible';
  if (!reference) return 'ok';
  if (
    pesos < reference.median * PLAUSIBILITY.lowRatio ||
    pesos > reference.median * PLAUSIBILITY.highRatio
  ) {
    return 'atipico';
  }
  return 'ok';
}

// Si al precio escrito le faltan ceros, el primer múltiplo que cae dentro del rango visto.
export function suggestPrice(pesos: number, reference: Reference): number | null {
  for (const factor of PLAUSIBILITY.suggestionFactors) {
    const candidate = pesos * factor;
    if (candidate >= reference.min && candidate <= reference.max) return candidate;
  }
  return null;
}
