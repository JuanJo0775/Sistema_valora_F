import type { components } from '../api/schema';
import { formatCop } from '../money';
import { restrictionsOf } from '../promotionText';
import './promotionList.css';

type Deal = Pick<
  components['schemas']['StorePromotion'],
  'type' | 'conditions' | 'officialPriceCop' | 'promotedPriceCop'
>;

// El «antes», el precio con la promoción y sus condiciones: igual en la comparación y en la ficha.
export function PromotionDeal({ promotion }: { promotion: Deal }) {
  const restrictions = restrictionsOf(promotion);
  return (
    <>
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
    </>
  );
}
