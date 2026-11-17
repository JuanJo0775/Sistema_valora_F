import { formatCop } from '../../shared/money';
import { Loading } from '../../shared/ui/Loading';
import { MUNICIPALITIES } from '../comparison/criteria';
import type { BasketItem } from './basketContext';
import { useStoreTotals } from './useStoreTotals';

// #31: «Todo en una tienda»: la tienda del municipio elegido con todo lo que falta comprar, al
// menor total. Las cuentas las hace useStoreTotals.
export function CheapestStore({ items }: { items: BasketItem[] }) {
  const { municipality, totals } = useStoreTotals(items);
  if (totals.status === 'empty') return null;
  const ready = totals.status === 'ready' ? totals : null;
  const best = ready?.best;
  const priciest = ready?.priciest;

  return (
    <aside className="side cheapest-store" aria-label="Dónde te sale más barata">
      <h2>{`Dónde te sale más barata en ${MUNICIPALITIES[municipality]}`}</h2>
      {totals.status === 'loading' && <Loading text="Buscando precios…" />}
      {totals.status === 'failed' && (
        <p className="muted">No pudimos calcular dónde te sale más barata.</p>
      )}
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
            {ready.totals.slice(0, 5).map(({ store, found }) => (
              <li
                key={store.id}
              >{`${store.name}: ${String(found)} de ${String(ready.pending)}`}</li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
