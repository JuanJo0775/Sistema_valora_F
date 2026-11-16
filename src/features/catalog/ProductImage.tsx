import type { components } from '../../shared/api/schema';

type Image = NonNullable<components['schemas']['Product']['image']>;

export function ProductImage({ name, image }: { name: string; image?: Image }) {
  if (!image) return null;
  return <img src={image.url} alt={name} className="product-image" />;
}
