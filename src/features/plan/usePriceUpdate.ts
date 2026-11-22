import { useState } from 'react';
import { api, call } from '../../shared/api';
import { askLocation } from '../../shared/location';
import type { Area } from '../basket/useStoreTotals';
import { diffPrices, type LineDiff, type PriceOffer, type SavedPlan } from './savedPlan';

export type PriceUpdate =
  { status: 'idle' | 'loading' | 'denied' | 'failed' } | { status: 'ready'; diffs: LineDiff[] };

// El área de la búsqueda: el municipio guardado, o la ubicación del momento (nunca guardada, EC-08).
async function areaOf(plan: SavedPlan): Promise<Area> {
  if (plan.area.kind === 'municipio') return { municipality: plan.area.municipality };
  const { lat, lng } = await askLocation();
  return { lat, lng, radiusKm: plan.area.radiusKm };
}

// «Actualizar precios»: vuelve a consultar la comparación de cada producto del plan que tiene tienda
// y precio, y deja las diferencias en memoria. No modifica el plan guardado.
export function usePriceUpdate(plan: SavedPlan | undefined) {
  const [state, setState] = useState<PriceUpdate>({ status: 'idle' });

  const run = async () => {
    if (!plan) return;
    setState({ status: 'loading' });
    let area: Area;
    try {
      area = await areaOf(plan);
    } catch {
      setState({ status: 'denied' });
      return;
    }
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
