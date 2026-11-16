import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { formatPresentation } from '../catalog/presentation';
import './reports.css';

type Product = components['schemas']['Product'];

// EC-01: una sola pantalla con lo que ya se sabe lleno, para reportar en 15 segundos o menos.
export function ReportPrice() {
  const [params] = useSearchParams();
  const productId = params.get('producto') ?? '';
  const [product, setProduct] = useState<Product | null>(null);
  const [presentationId, setPresentationId] = useState('');

  useEffect(() => {
    void call(api.GET('/products/{productId}', { params: { path: { productId } } })).then(
      setProduct,
    );
  }, [productId]);

  if (!product) return null;
  return (
    <form className="report">
      <h1>{product.name}</h1>
      <fieldset role="radiogroup" className="choices">
        <legend>Presentación</legend>
        {product.presentations.map((presentation) => (
          <label key={presentation.id} className="choice">
            <input
              type="radio"
              name="presentation"
              value={presentation.id}
              checked={presentationId === presentation.id}
              onChange={() => {
                setPresentationId(presentation.id);
              }}
            />
            {formatPresentation(presentation)}
          </label>
        ))}
      </fieldset>
    </form>
  );
}
