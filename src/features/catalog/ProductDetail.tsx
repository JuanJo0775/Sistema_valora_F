import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { formatPresentation } from './presentation';
import './catalog.css';

type Product = components['schemas']['Product'];

export function ProductDetail() {
  const { productId = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    void call(api.GET('/products/{productId}', { params: { path: { productId } } })).then(
      setProduct,
    );
  }, [productId]);

  if (!product) return null;
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
