import { useId } from 'react';
import type { components } from '../../shared/api/schema';
import { shortDay } from '../../shared/days';
import { offerName } from '../../shared/promotionText';
import { PromotionDeal } from '../../shared/ui/PromotionDeal';

type Promotion = components['schemas']['StorePromotion'];

// H6 y ADR-009: las promociones activas de la tienda, aparte de sus precios.
export function StorePromotions({ promotions = [] }: { promotions?: Promotion[] }) {
  const title = useId();
  if (promotions.length === 0) return null;
  return (
    <section className="promotion-list store-promotions" aria-labelledby={title}>
      <h2 id={title}>Promociones</h2>
      <ul>
        {promotions.map((promotion) => {
          return (
            <li key={promotion.id}>
              <div>
                <h3>{promotion.productName}</h3>
                <p>
                  <strong>{offerName(promotion)}</strong>
                </p>
                <p className="muted">{`Hasta el ${shortDay(promotion.validUntil)}`}</p>
              </div>
              <PromotionDeal promotion={promotion} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
