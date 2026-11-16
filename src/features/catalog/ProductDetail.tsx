import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { formatPresentation } from './presentation';
import './catalog.css';

type Product = components['schemas']['Product'];

// Resultado de la consulta, marcado con el producto que lo pidió.
type Outcome = { key: string; product: Product } | { key: string; error: unknown };

export function ProductDetail() {
  const { productId = '' } = useParams();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let current = true;
    call(api.GET('/products/{productId}', { params: { path: { productId } } }))
      .then((product) => {
        if (current) setOutcome({ key: productId, product });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key: productId, error });
      });
    return () => {
      current = false;
    };
  }, [productId]);

  const result = outcome?.key === productId ? outcome : null;
  if (result && 'error' in result) {
    return (
      <EmptyState
        title="No encontramos este producto"
        action={
          <Link to="/" className="btn ghost">
            Buscar otro producto
          </Link>
        }
      />
    );
  }
  if (!result) return null;
  const { product } = result;
  return (
    <article className="detail">
      <h1>{product.name}</h1>
      <p className="muted">{[product.brand, product.category.name].filter(Boolean).join(' · ')}</p>
      <h2 id="presentaciones">Presentaciones</h2>
      <ul aria-labelledby="presentaciones" className="chips">
        {product.presentations.map((presentation) => (
          <li key={presentation.id} className="pill mute">
            {formatPresentation(presentation)}
          </li>
        ))}
      </ul>
    </article>
  );
}
