import { useState } from 'react';
import type { components } from '../../shared/api/schema';
import { ProductFrame } from './ProductFrame';

type Image = NonNullable<components['schemas']['Product']['image']>;

// Foto del detalle del producto, en el mismo marco que las miniaturas. ADR-020: sin foto, la
// ilustración de su categoría (o una bolsa genérica), sin marcas; decorativa, porque el nombre del
// producto ya está en el texto de la pantalla.
export function ProductImage({
  name,
  image,
  category,
}: {
  name: string;
  image?: Image;
  category?: string;
}) {
  const [shown, setShown] = useState(image !== undefined);
  return (
    <figure className="product-image">
      <ProductFrame
        image={image}
        category={category}
        size="detail"
        alt={name}
        zoomable
        onPhotoShown={setShown}
      />
      {/* ADR-020: Open Food Facts (ODbL) exige citar la fuente; las fotos del equipo son propias. */}
      {shown && image?.source === 'open_food_facts' && (
        <figcaption className="muted">Foto: {image.attribution}</figcaption>
      )}
    </figure>
  );
}
