import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { formatPresentation } from '../catalog/presentation';
import { formatCop, formatUnitPrice } from './money';
import './comparison.css';

type Product = components['schemas']['Product'];
type Comparison = components['schemas']['Comparison'];

// P7 (neutralidad, EC-06): el orden lo decide el backend con el criterio declarado; la pantalla
// no reordena ni destaca a nadie más que a lo que el backend marca.
export function ComparePrices() {
  const { productId = '' } = useParams();
  const [data, setData] = useState<{ product: Product; comparison: Comparison } | null>(null);

  useEffect(() => {
    void Promise.all([
      call(api.GET('/products/{productId}', { params: { path: { productId } } })),
      call(
        api.GET('/products/{productId}/comparison', {
          params: { path: { productId }, query: { municipality: 'armenia' } },
        }),
      ),
    ]).then(([product, comparison]) => {
      setData({ product, comparison });
    });
  }, [productId]);

  if (!data) return null;
  const sizeOf = (presentationId: string) => {
    const presentation = data.product.presentations.find(({ id }) => id === presentationId);
    return presentation ? formatPresentation(presentation) : '';
  };
  return (
    <section className="compare">
      <h1>{data.product.name}</h1>
      <ul className="offers">
        {data.comparison.results.map((offer) => (
          <li key={offer.reportId} className="offer">
            <h2>{offer.establishment.name}</h2>
            <p>
              {sizeOf(offer.presentationId)} · {formatCop(offer.priceCop)}
            </p>
            <p className="unit">{formatUnitPrice(offer.unitPrice)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
