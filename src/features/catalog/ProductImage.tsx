import { useState } from 'react';
import type { components } from '../../shared/api/schema';

type Image = NonNullable<components['schemas']['Product']['image']>;

// ADR-020: sin foto, una bolsa de mercado genérica, sin marcas.
function Illustration({ name }: { name: string }) {
  return (
    <svg
      role="img"
      aria-label={`${name} (sin foto)`}
      viewBox="0 0 64 64"
      className="product-image illustration"
    >
      <path d="M14 22h36l-3 32H17z" />
      <path d="M24 22v-4a8 8 0 0 1 16 0v4" fill="none" />
    </svg>
  );
}

export function ProductImage({ name, image }: { name: string; image?: Image }) {
  // Un enlace roto (Open Food Facts cambió la foto, el servidor no responde) no deja un hueco.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!image || failedUrl === image.url) return <Illustration name={name} />;
  return (
    <figure className="product-image">
      <img
        src={image.url}
        alt={name}
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
