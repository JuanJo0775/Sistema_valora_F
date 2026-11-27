import { useId } from 'react';
import { Link } from 'react-router';
import type { components } from '../../shared/api/schema';
import { shortDay } from '../../shared/days';
import { offerName } from '../../shared/promotionText';
import { PromotionDeal } from '../../shared/ui/PromotionDeal';

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
    <section className="promotion-list comparison-promotions" aria-labelledby={title}>
      <h3 id={title}>Promociones</h3>
      <ul>
        {promotions.map((promotion) => {
          const { establishment } = promotion;
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
              <PromotionDeal promotion={promotion} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
