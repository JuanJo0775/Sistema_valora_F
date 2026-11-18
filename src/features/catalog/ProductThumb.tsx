import { useState } from 'react';
import type { components } from '../../shared/api/schema';
import { CategoryArt } from './CategoryArt';

type Image = components['schemas']['ProductImage'];

const SIZES = { card: 64, row: 44 } as const;

// Miniatura de las tarjetas y las filas (Inicio, búsqueda, sugerencias). Decorativa: el nombre del
// producto ya está en texto al lado, así que no se lee dos veces. Tamaño fijo, sin saltos de diseño.
// ADR-020: la atribución completa de Open Food Facts queda en el detalle; aquí va en el title.
export function ProductThumb({
  image,
  size,
  category,
}: {
  image?: Image;
  size: keyof typeof SIZES;
  // Código de la categoría: sin foto (o con la foto rota) se dibuja su ilustración.
  category?: string;
}) {
  // Un enlace roto no deja un hueco: vuelve a la ilustración de su categoría, como el detalle.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const px = SIZES[size];
  const photo = image && failedUrl !== image.url ? image : null;
  const credit = photo?.source === 'open_food_facts' ? `Foto: ${photo.attribution}` : undefined;
  return (
    <span className={`product-thumb ${size}`} title={credit}>
      {photo ? (
        <img
          src={photo.url}
          alt=""
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          onError={() => {
            setFailedUrl(photo.url);
          }}
        />
      ) : (
        <CategoryArt category={category} size={px} />
      )}
    </span>
  );
}
