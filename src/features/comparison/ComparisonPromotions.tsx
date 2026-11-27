import { useId } from 'react';
import { Link } from 'react-router';
import type { components } from '../../shared/api/schema';
import { shortDay } from '../../shared/days';
import { formatCop } from '../../shared/money';
import { offerName, restrictionsOf } from '../../shared/promotionText';

type Promotion = components['schemas']['ComparisonPromotion'];

export function ComparisonPromotions({
  promotions = [],
  sizeOf,
}: {
  // Las comparaciones guardadas sin conexión pueden ser anteriores a este campo.
  promotions?: Promotion[];
  sizeOf: (presentationId: string) => string;
}) {
  const title = useId();
  if (promotions.length === 0) return null;

  return (
    <section className="comparison-promotions" aria-labelledby={title}>
      <h3 id={title}>Promociones</h3>
      <ul>
        {promotions.map((promotion) => {
          const { establishment } = promotion;
          const restrictions = restrictionsOf(promotion);
          return (
            <li key={promotion.id}>
              <div>
                <h4>
                  <Link to={`/tiendas/${establishment.id}`}>{establishment.name}</Link>
                </h4>
                <p className="muted">
                  {[
                    sizeOf(promotion.presentationId),
                    establishment.address,
                    `Hasta el ${shortDay(promotion.validUntil)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p>
                  <strong>{offerName(promotion)}</strong>
                </p>
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
