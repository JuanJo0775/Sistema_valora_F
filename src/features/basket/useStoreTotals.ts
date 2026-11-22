import { useEffect, useMemo, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import type { Municipality } from '../comparison/criteria';
import { readMunicipality } from '../comparison/lastMunicipality';
import type { BasketItem } from './basketContext';
import { type BasketLine, type StoreTotal, totalsByStore } from './totals';

type Offer = components['schemas']['ComparisonItem'];

export type StoreTotals =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'ready';
      totals: StoreTotal[];
      best: StoreTotal | undefined;
      priciest: StoreTotal | undefined;
      pending: number;
      // Las ofertas de cada producto de la canasta: el plan de compra reparte con ellas.
      lines: BasketLine[];
    };

// Dónde buscar: un municipio, o la ubicación del momento con su radio (misma forma que
// useWhere().query). La ubicación solo viaja en la consulta: este hook no la guarda (EC-08).
export type Area = { municipality: Municipality } | { lat: number; lng: number; radiusKm: number };

// #31: cuánto cuesta lo que falta comprar en cada tienda del municipio elegido. Un pedido a la
// comparación por producto (precios vigentes); el frontend solo suma con la presentación exacta
// y la cantidad. Lo usan la canasta y el Inicio (#66). Sin `area` busca por el municipio
// recordado; el plan de compra pasa el área que eligió la persona.
export function useStoreTotals(items: BasketItem[], area?: Area) {
  const [municipality] = useState(readMunicipality);
  const pending = items.filter(({ bought }) => !bought);
  const productIds = [...new Set(pending.map(({ productId }) => productId))].sort((a, b) =>
    a.localeCompare(b),
  );
  // El área entra en la clave: si cambia, se consulta de nuevo.
  const key = `${productIds.join(',')}|${JSON.stringify(area ?? { municipality })}`;
  const [offers, setOffers] = useState<
    { key: string; byProduct: Map<string, Offer[]> } | { key: string; failed: true } | null
  >(null);

  useEffect(() => {
    const [list = '', where = ''] = key.split('|');
    if (!list) return;
    const query = JSON.parse(where) as Area;
    let current = true;
    void Promise.all(
      list.split(',').map((productId) =>
        call(
          api.GET('/products/{productId}/comparison', {
            params: {
              path: { productId },
              query: { ...query, sort: 'unit_price', onlyCurrent: true },
            },
          }),
        ).then(({ results }) => [productId, results] as const),
      ),
    )
      .then((entries) => {
        if (current) setOffers({ key, byProduct: new Map(entries) });
      })
      .catch(() => {
        if (current) setOffers({ key, failed: true });
      });
    return () => {
      current = false;
    };
  }, [key]);

  const result = offers?.key === key ? offers : null;
  // Estable mientras no cambien la canasta ni la respuesta: quien reparte con `lines` no recalcula.
  const totals = useMemo((): StoreTotals => {
    const pending = items.filter(({ bought }) => !bought);
    if (pending.length === 0) return { status: 'empty' };
    if (!result) return { status: 'loading' };
    if (!('byProduct' in result)) return { status: 'failed' };
    const lines = pending.map(({ productId, presentationId, quantity }) => ({
      presentationId,
      quantity,
      offers: result.byProduct.get(productId) ?? [],
    }));
    const all = totalsByStore(lines);
    const complete = all.filter((total) => total.complete);
    return {
      status: 'ready',
      totals: all,
      best: complete[0],
      priciest: complete.at(-1),
      pending: pending.length,
      lines,
    };
  }, [items, result]);
  return { municipality, totals };
}
