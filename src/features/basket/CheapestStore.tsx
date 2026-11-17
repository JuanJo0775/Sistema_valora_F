import { formatCop } from '../../shared/money';
import { Loading } from '../../shared/ui/Loading';
import { MUNICIPALITIES } from '../comparison/criteria';
import type { Municipality } from '../comparison/criteria';
import type { StoreTotals } from './useStoreTotals';

// #31 y #78 (prototipo): «Todo en una tienda», la tienda del municipio elegido con todo lo que
// falta comprar, al menor total. Las cuentas las hace useStoreTotals en la página de la canasta.
export function CheapestStore({
  municipality,
  totals,
}: {
  municipality: Municipality;
  totals: StoreTotals;
}) {
  if (totals.status === 'empty') return null;
  const ready = totals.status === 'ready' ? totals : null;
  const best = ready?.best;
  const priciest = ready?.priciest;

  return (
    <aside className="side cheapest-store" aria-label="Dónde te sale más barata">
      <h2>
        {best ? 'Compra todo en' : `Dónde te sale más barata en ${MUNICIPALITIES[municipality]}`}
      </h2>
      {totals.status === 'loading' && <Loading text="Buscando precios…" />}
      {totals.status === 'failed' && (
        <p className="muted">No pudimos calcular dónde te sale más barata.</p>
      )}
      {ready && best && (
        <>
          <p className="cheapest-store-name">{best.store.name}</p>
          <p className="cheapest-store-total">
            <span className="unit">{formatCop(best.totalCop)}</span>
            {priciest && priciest.totalCop > best.totalCop && (
              <span className="pill ok">{`Ahorras ${formatCop(priciest.totalCop - best.totalCop)}`}</span>
            )}
          </p>
          {priciest && priciest.totalCop > best.totalCop && (
            <p className="muted">
              {`Comparado con la tienda más cara: ${priciest.store.name}, ${formatCop(priciest.totalCop)}.`}
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
