import type { components } from '../../shared/api/schema';

type Image = NonNullable<components['schemas']['Product']['image']>;

export function ProductImage(_props: { name: string; image?: Image }) {
  return null;
}
