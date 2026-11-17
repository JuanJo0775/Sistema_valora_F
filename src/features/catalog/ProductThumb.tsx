import { useState } from 'react';
import type { components } from '../../shared/api/schema';

type Image = components['schemas']['ProductImage'];

const SIZES = { card: 64, row: 44 } as const;

// Miniatura de las tarjetas y las filas (Inicio, búsqueda, sugerencias). Decorativa: el nombre del
// producto ya está en texto al lado, así que no se lee dos veces. Tamaño fijo, sin saltos de diseño.
// ADR-020: la atribución completa de Open Food Facts queda en el detalle; aquí va en el title.
export function ProductThumb({ image, size }: { image?: Image; size: keyof typeof SIZES }) {
  // Un enlace roto no deja un hueco: vuelve a la ilustración genérica, como el detalle.
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
        <svg aria-hidden="true" viewBox="0 0 64 64" width={px} height={px}>
          <path d="M14 22h36l-3 32H17z" />
          <path d="M24 22v-4a8 8 0 0 1 16 0v4" fill="none" />
        </svg>
      )}
    </span>
  );
}
