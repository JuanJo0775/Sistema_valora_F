import { useState } from 'react';
import { api, call } from '../../shared/api';
import { readMunicipality } from '../comparison/lastMunicipality';
import type { Area } from '../basket/useStoreTotals';
import { diffPrices, type LineDiff, type PriceOffer, type SavedPlan } from './savedPlan';

export type PriceUpdate =
  { status: 'idle' | 'loading' | 'failed' } | { status: 'ready'; diffs: LineDiff[] };

// Dónde buscar: siempre por municipio (ADR-031), la misma consulta que comparte la caché con el resto
// de la app. Un plan de «cerca de mí» no guarda la ubicación: se usa el municipio de sus tiendas y
// solo se comparan precios (no hay distancias que calcular).
const areaOf = (plan: SavedPlan): Area => ({
  municipality:
    plan.area.kind === 'municipio'
      ? plan.area.municipality
      : (plan.stores[0]?.municipality ?? readMunicipality()),
});

// «Actualizar precios»: vuelve a consultar la comparación de cada producto del plan que tiene tienda
// y precio, y deja las diferencias en memoria. No modifica el plan guardado.
export function usePriceUpdate(plan: SavedPlan | undefined) {
  const [state, setState] = useState<PriceUpdate>({ status: 'idle' });

  const run = async () => {
    if (!plan) return;
    setState({ status: 'loading' });
    const area = areaOf(plan);
    const ids = [
      ...new Set(
        plan.lines.filter((l) => l.storeId !== null && l.priceCop !== null).map((l) => l.productId),
      ),
    ];
    try {
      const entries = await Promise.all(
        ids.map((productId) =>
          call(
            api.GET('/products/{productId}/comparison', {
              params: {
                path: { productId },
                query: { ...area, sort: 'unit_price', onlyCurrent: true },
              },
            }),
          ).then(({ results }) => [productId, results as PriceOffer[]] as const),
        ),
      );
      setState({ status: 'ready', diffs: diffPrices(plan, new Map(entries)) });
    } catch {
      setState({ status: 'failed' });
    }
  };

  return {
    state,
    run,
    reset: () => {
      setState({ status: 'idle' });
    },
  };
}
