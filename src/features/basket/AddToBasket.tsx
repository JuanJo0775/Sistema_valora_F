import type { components } from '../../shared/api/schema';

export function AddToBasket({ product }: { product: components['schemas']['Product'] }) {
  return <p hidden>{product.name}</p>;
}
