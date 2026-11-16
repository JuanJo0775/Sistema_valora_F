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

export const totalsByStore = (lines: BasketLine[]): StoreTotal[] => lines.flatMap(() => []);
