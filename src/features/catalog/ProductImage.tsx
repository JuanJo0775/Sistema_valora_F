import { useState } from 'react';
import type { components } from '../../shared/api/schema';
import { CategoryArt } from './CategoryArt';

type Image = NonNullable<components['schemas']['Product']['image']>;

// ADR-020: sin foto, la ilustración de su categoría (o una bolsa genérica), sin marcas. Decorativa:
// el nombre del producto ya está en el texto de la pantalla.
function Illustration({ category }: { category?: string }) {
  return (
    <span className="product-image illustration">
      <CategoryArt category={category} />
    </span>
  );
}

export function ProductImage({
  name,
  image,
  category,
}: {
  name: string;
  image?: Image;
  category?: string;
}) {
  // Un enlace roto (Open Food Facts cambió la foto, el servidor no responde) no deja un hueco.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!image || failedUrl === image.url) return <Illustration category={category} />;
  return (
    <figure className="product-image">
      <img
        src={image.url}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => {
          setFailedUrl(image.url);
        }}
      />
      {/* ADR-020: Open Food Facts (ODbL) exige citar la fuente; las fotos del equipo son propias. */}
      {image.source === 'open_food_facts' && (
        <figcaption className="muted">Foto: {image.attribution}</figcaption>
      )}
    </figure>
  );
}
