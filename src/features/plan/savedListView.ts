import { formatCop } from '../../shared/money';
import type { BasketItem } from '../basket/basketContext';
import type { SavedPlan } from './savedPlan';

const count = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

// Una lista sin tiendas elegidas o sin ofertas vigentes: solo sus productos.
export const hasPrices = (plan: SavedPlan): boolean =>
  plan.stores.length > 0 && plan.lines.some((l) => l.priceCop !== null);

// «3 productos · 2 tiendas · $13.380 en productos», o «3 productos · Sin precios guardados».
export function listSummary(plan: SavedPlan): string {
  const products = count(plan.lines.length, 'producto', 'productos');
  if (!hasPrices(plan)) return `${products} · Sin precios guardados`;
  const { stores, productsCop } = plan.summary;
  return `${products} · ${count(stores, 'tienda', 'tiendas')} · ${formatCop(productsCop)} en productos`;
}

// Las líneas de la lista como productos de la canasta: todo por comprar.
export const toBasketItems = (plan: SavedPlan): BasketItem[] =>
  plan.lines.map((l) => ({
    productId: l.productId,
    productName: l.productName,
    presentationId: l.presentationId,
    presentationLabel: l.presentationLabel,
    quantity: l.quantity,
    bought: false,
  }));
