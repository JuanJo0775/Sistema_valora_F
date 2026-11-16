import { useEffect, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { formatCop } from '../../shared/money';
import { Loading } from '../../shared/ui/Loading';
import { MUNICIPALITIES } from '../comparison/criteria';
import { readMunicipality } from '../comparison/lastMunicipality';
import type { BasketItem } from './basketContext';
import { totalsByStore } from './totals';

type Offer = components['schemas']['ComparisonItem'];

// #31: «Todo en una tienda». Un pedido a la comparación por producto (precios vigentes del
// municipio elegido); el frontend solo suma con la presentación exacta y la cantidad.
export function CheapestStore({ items }: { items: BasketItem[] }) {
  const [municipality] = useState(readMunicipality);
  const pending = items.filter(({ bought }) => !bought);
  const productIds = [...new Set(pending.map(({ productId }) => productId))].sort();
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

  if (pending.length === 0) return null;
  const result = offers?.key === key ? offers : null;
  const ready = result && 'byProduct' in result ? result.byProduct : null;
  const totals = ready
    ? totalsByStore(
        pending.map(({ productId, presentationId, quantity }) => ({
          presentationId,
          quantity,
          offers: ready.get(productId) ?? [],
        })),
      )
    : [];
  const complete = totals.filter((total) => total.complete);
  const [best] = complete;
  const priciest = complete.at(-1);

  return (
    <aside className="side cheapest-store" aria-label="Dónde te sale más barata">
      <h2>{`Dónde te sale más barata en ${MUNICIPALITIES[municipality]}`}</h2>
      {!result && <Loading text="Buscando precios…" />}
      {result && !ready && <p className="muted">No pudimos calcular dónde te sale más barata.</p>}
      {ready && best && (
        <>
          <p>
            <strong>{`Compra todo en ${best.store.name}`}</strong>
          </p>
          <p className="unit">{formatCop(best.totalCop)}</p>
          {priciest && priciest.totalCop > best.totalCop && (
            <p className="muted">
              {`Ahorras ${formatCop(priciest.totalCop - best.totalCop)} frente a ${priciest.store.name} (${formatCop(priciest.totalCop)})`}
            </p>
          )}
        </>
      )}
      {ready && !best && (
        <>
          <p>Ninguna tienda tiene todos tus productos.</p>
          <ul className="muted">
            {totals.slice(0, 5).map(({ store, found }) => (
              <li
                key={store.id}
              >{`${store.name}: ${String(found)} de ${String(pending.length)}`}</li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
