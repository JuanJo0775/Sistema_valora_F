import type { components } from '../../shared/api/schema';

type Image = NonNullable<components['schemas']['Product']['image']>;

export function ProductImage({ name, image }: { name: string; image?: Image }) {
  if (!image) return null;
  return (
    <figure className="product-image">
      <img src={image.url} alt={name} />
      <figcaption className="muted">Foto: {image.attribution}</figcaption>
    </figure>
  );
}
