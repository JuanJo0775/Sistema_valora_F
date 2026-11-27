import { useId } from 'react';
import type { components } from '../../shared/api/schema';
import { shortDay } from '../../shared/days';
import { formatCop } from '../../shared/money';
import { offerName, restrictionsOf } from '../../shared/promotionText';

type Promotion = components['schemas']['StorePromotion'];

// H6 y ADR-009: las promociones activas de la tienda, aparte de sus precios.
export function StorePromotions({ promotions = [] }: { promotions?: Promotion[] }) {
  const title = useId();
  if (promotions.length === 0) return null;
  return (
    <section className="store-promotions" aria-labelledby={title}>
      <h2 id={title}>Promociones</h2>
      <ul>
        {promotions.map((promotion) => {
          const restrictions = restrictionsOf(promotion);
          return (
            <li key={promotion.id}>
              <div>
                <h3>{promotion.productName}</h3>
                <p>
                  <strong>{offerName(promotion)}</strong>
                </p>
                <p className="muted">{`Hasta el ${shortDay(promotion.validUntil)}`}</p>
              </div>
              <div>
                <p className="muted">Antes {formatCop(promotion.officialPriceCop)}</p>
                <p>
                  <strong>{formatCop(promotion.promotedPriceCop)}</strong>
                  {promotion.type === 'pague_x_lleve_y' ? ' por unidad en promedio' : ''}
                </p>
              </div>
              {restrictions.length > 0 && (
                <p className="muted promotion-conditions">{restrictions.join(' · ')}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
