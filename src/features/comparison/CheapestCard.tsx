import { useId } from 'react';
import { formatDistance } from '../../shared/location';
import { formatCop, formatUnitPrice } from '../../shared/money';
import { FreshnessBadge } from '../../shared/ui/FreshnessBadge';
import type { Comparison } from './AllStores';
import { MUNICIPALITIES } from './criteria';
import './comparison.css';

// Prototipo: la tarjeta naranja del panel con el precio que el backend marcó como el más barato
// (isCheapest). La pantalla no lo elige: solo lo muestra (EC-06).
export function CheapestCard({
  comparison,
  sizeOf,
}: {
  comparison: Comparison;
  sizeOf: (presentationId: string) => string;
}) {
  const title = useId();
  const cheapest = comparison.results.find(({ isCheapest }) => isCheapest);
  if (!cheapest) return null;
  const { municipality } = comparison.criteria;
  const where = municipality ? `en ${MUNICIPALITIES[municipality]}` : 'cerca de ti';
  const { establishment } = cheapest;
  return (
    <section className="cheapest-card" aria-labelledby={title}>
      <h2 id={title} className="eyebrow">{`Más barato ${where}`}</h2>
      <p className="cheapest-price">
        <strong>{formatCop(cheapest.priceCop)}</strong>
        <span className="muted">{`${sizeOf(cheapest.presentationId)} · ${formatUnitPrice(cheapest.unitPrice)}`}</span>
      </p>
      <p className="cheapest-card-store">
        <strong>{establishment.name}</strong>
        {establishment.distanceM !== undefined && (
          <span className="muted">{formatDistance(establishment.distanceM)}</span>
        )}
        <FreshnessBadge freshness={cheapest.freshness} observedAt={cheapest.observedAt} />
      </p>
      {/* B#128: el ahorro lo calcula el backend con el precio por unidad. */}
      {comparison.savingsPercent !== undefined && (
        <p className="muted">{`Hasta ${String(comparison.savingsPercent)} % menos que la tienda más cara.`}</p>
      )}
    </section>
  );
}
