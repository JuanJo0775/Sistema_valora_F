import { formatCop } from '../../shared/money';
import { Loading } from '../../shared/ui/Loading';
import { MUNICIPALITIES } from '../comparison/criteria';
import type { Municipality } from '../comparison/criteria';
import { formatDistance } from '../../shared/location';
import type { BasketItem } from './basketContext';
import type { StoreTotals } from './useStoreTotals';

// #31 y #78 (prototipo): «Todo en una tienda», la tienda del municipio elegido con todo lo que
// falta comprar, al menor total. Las cuentas las hace useStoreTotals en la página de la canasta;
// es la ficha «1 tienda» del panel «Dónde comprar» (WhereToBuy), que pone el título y el enlace al plan.
export function CheapestStore({
  municipality,
  totals,
  items = [],
}: {
  municipality: Municipality;
  totals: StoreTotals;
  // Lo que falta comprar: para decir qué no tiene una tienda.
  items?: BasketItem[];
}) {
  if (totals.status === 'empty') return null;
  const ready = totals.status === 'ready' ? totals : null;
  const best = ready?.best;
  const priciest = ready?.priciest;

  return (
    <div className="cheapest-store">
      <h3>
        {best ? 'Compra todo en' : `Dónde te sale más barata en ${MUNICIPALITIES[municipality]}`}
      </h3>
      {totals.status === 'loading' && <Loading text="Buscando precios…" />}
      {totals.status === 'failed' && (
        <p className="muted">No pudimos calcular dónde te sale más barata.</p>
      )}
      {ready && best && (
        <>
          <p className="cheapest-store-name">{best.store.name}</p>
          {/* Hay varias tiendas con el mismo nombre: la dirección o la distancia dice cuál. */}
          {(best.store.address ?? best.store.distanceM !== undefined) && (
            <p className="muted">
              {[
                best.store.address,
                best.store.distanceM !== undefined ? formatDistance(best.store.distanceM) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          <p className="muted">{`Tiene ${String(best.found)} de ${String(ready.pending)} productos.`}</p>
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
            {ready.totals.slice(0, 5).map(({ store, found, presentationIds }) => {
              const missing = items
                .filter(({ presentationId }) => !presentationIds.includes(presentationId))
                .map(({ productName }) => productName);
              return (
                <li key={store.id}>
                  {`${store.name}${store.address ? ` (${store.address})` : ''}: tiene ${String(found)} de ${String(ready.pending)}`}
                  {missing.length > 0 && `; le falta ${missing.join(', ')}`}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
