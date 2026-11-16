import type { components } from '../../shared/api/schema';

type Offer = components['schemas']['ComparisonItem'];
type Store = Offer['establishment'];

// Un producto de la canasta con los precios que trajo su comparación.
export interface BasketLine {
  presentationId: string;
  quantity: number;
  offers: Offer[];
}

export interface StoreTotal {
  store: Store;
  totalCop: number;
  found: number;
  complete: boolean;
}

// #31: el frontend solo suma. Los precios, su vigencia y qué tienda entra los decide el backend en
// cada comparación; aquí se multiplica por la cantidad y se agrupa por tienda.
export function totalsByStore(lines: BasketLine[]): StoreTotal[] {
  const byStore = new Map<string, StoreTotal>();
  for (const { presentationId, quantity, offers } of lines) {
    for (const offer of offers) {
      if (offer.presentationId !== presentationId) continue;
      const current = byStore.get(offer.establishment.id) ?? {
        store: offer.establishment,
        totalCop: 0,
        found: 0,
        complete: false,
      };
      current.totalCop += offer.priceCop * quantity;
      current.found += 1;
      byStore.set(offer.establishment.id, current);
    }
  }
  return [...byStore.values()].map((total) => ({
    ...total,
    complete: total.found === lines.length,
  }));
}
