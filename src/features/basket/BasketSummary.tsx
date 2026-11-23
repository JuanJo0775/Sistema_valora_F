import { useId } from 'react';
import { Link } from 'react-router';
import { formatCop } from '../../shared/money';
import { useBasket } from './basketContext';
import { usePlans } from '../plan/usePlans';
import { useStoreTotals } from './useStoreTotals';
import './basket.css';

// #66 (prototipo): la tarjeta «Tu canasta» del Inicio. Cuántos productos faltan por comprar, el
// total en la tienda donde sale más barata y cuánto se ahorra frente a la más cara (#31). Con listas
// guardadas en este navegador suma el paso a «Guardadas»; con la canasta vacía, lo ofrece como invitación.
export function BasketSummary() {
  const { items } = useBasket();
  const { totals } = useStoreTotals(items);
  const title = useId();
  const saved = usePlans().length;
  const savedUrl = '/canasta?tab=guardadas';
  if (totals.status === 'empty') {
    if (saved === 0) return null;
    return (
      <section className="basket-summary" aria-labelledby={title}>
        <h2 id={title} className="eyebrow">
          Tu canasta
        </h2>
        <p className="muted">Tu canasta está vacía.</p>
        <Link to={savedUrl} className="btn">
          Abre una lista guardada
        </Link>
      </section>
    );
  }
  const pending = items.filter(({ bought }) => !bought).length;
  const ready = totals.status === 'ready' ? totals : null;
  const best = ready?.best;
  const priciest = ready?.priciest;
  return (
    <section className="basket-summary" aria-labelledby={title}>
      <h2 id={title} className="eyebrow">
        {`Tu canasta · ${String(pending)} ${pending === 1 ? 'producto' : 'productos'}`}
      </h2>
      {best && (
        <>
          <p className="basket-total">{formatCop(best.totalCop)}</p>
          <p className="muted">{`Comprando en ${best.store.name}`}</p>
          {priciest && priciest.totalCop > best.totalCop && (
            <p>
              <span className="pill ok">{`Ahorras ${formatCop(priciest.totalCop - best.totalCop)}`}</span>
            </p>
          )}
        </>
      )}
      {ready && !best && <p className="muted">Ninguna tienda tiene todo.</p>}
      <Link to="/canasta" className="btn">
        Ver mi canasta
      </Link>
      {saved > 0 && (
        <Link to={savedUrl} className="btn ghost">
          {`Mis listas guardadas (${String(saved)})`}
        </Link>
      )}
    </section>
  );
}
