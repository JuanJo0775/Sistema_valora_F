import { useEffect, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { readMunicipality } from '../comparison/lastMunicipality';
import type { BasketItem } from './basketContext';
import { type StoreTotal, totalsByStore } from './totals';

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
    };

// #31: cuánto cuesta lo que falta comprar en cada tienda del municipio elegido. Un pedido a la
// comparación por producto (precios vigentes); el frontend solo suma con la presentación exacta
// y la cantidad. Lo usan la canasta y el Inicio (#66).
export function useStoreTotals(items: BasketItem[]) {
  const [municipality] = useState(readMunicipality);
  const pending = items.filter(({ bought }) => !bought);
  const productIds = [...new Set(pending.map(({ productId }) => productId))].sort((a, b) =>
    a.localeCompare(b),
  );
  const key = productIds.join(',');
  const [offers, setOffers] = useState<
    { key: string; byProduct: Map<string, Offer[]> } | { key: string; failed: true } | null
  >(null);

  useEffect(() => {
    if (!key) return;
    let current = true;
    void Promise.all(
      key.split(',').map((productId) =>
        call(
          api.GET('/products/{productId}/comparison', {
            params: {
              path: { productId },
              query: { municipality, sort: 'unit_price', onlyCurrent: true },
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
  }, [key, municipality]);

  const result = offers?.key === key ? offers : null;
  const totals = ((): StoreTotals => {
    if (pending.length === 0) return { status: 'empty' };
    if (!result) return { status: 'loading' };
    if (!('byProduct' in result)) return { status: 'failed' };
    const all = totalsByStore(
      pending.map(({ productId, presentationId, quantity }) => ({
        presentationId,
        quantity,
        offers: result.byProduct.get(productId) ?? [],
      })),
    );
    const complete = all.filter((total) => total.complete);
    return {
      status: 'ready',
      totals: all,
      best: complete[0],
      priciest: complete.at(-1),
      pending: pending.length,
    };
  })();
  return { municipality, totals };
}
