import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { FreshnessBadge } from '../../shared/ui/FreshnessBadge';
import { ReliabilityBadge } from '../../shared/ui/ReliabilityBadge';
import { formatPresentation } from '../catalog/presentation';
import { formatCop, formatUnitPrice } from './money';
import './comparison.css';

type Product = components['schemas']['Product'];
type Comparison = components['schemas']['Comparison'];
type Source = components['schemas']['ComparisonItem']['source'];

// Hoy todo es de la comunidad; «oficial» llega con el módulo comercial (Corte 3).
const SOURCE: Record<Source, string> = {
  comunidad: 'Comunidad',
  oficial: 'Precio oficial',
  siembra: 'Dato inicial',
};

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
            <p className="badges">
              {offer.isCheapest && <span className="pill ok">Más barato</span>}
              <FreshnessBadge freshness={offer.freshness} observedAt={offer.observedAt} />
              <ReliabilityBadge level={offer.reliability} />
              <span className="pill mute">{SOURCE[offer.source]}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
