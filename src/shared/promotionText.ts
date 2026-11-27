import type { components } from './api/schema';

type Offer = Pick<
  components['schemas']['StorePromotion'],
  'type' | 'percent' | 'takeY' | 'payX' | 'conditions'
>;

// El nombre de la oferta, igual en la comparación y en la ficha de la tienda.
export function offerName(promotion: Offer) {
  switch (promotion.type) {
    case 'precio_especial':
      return 'Precio especial';
    case 'descuento_porcentual':
      return `${String(promotion.percent)} % de descuento`;
    case 'pague_x_lleve_y':
      return `Lleve ${String(promotion.takeY)}, pague ${String(promotion.payX)}`;
  }
}

// Las condiciones fijas de la promoción, en lenguaje del cliente.
export function restrictionsOf({ conditions }: Pick<Offer, 'conditions'>) {
  return [
    conditions.paymentMethod === 'efectivo' && 'Solo efectivo',
    conditions.paymentMethod === 'tarjeta' && 'Solo tarjeta',
    conditions.maxPerCustomer !== undefined &&
      `Máximo ${String(conditions.maxPerCustomer)} por cliente`,
    conditions.whileStocksLast && 'Hasta agotar existencias',
  ].filter(Boolean);
}
