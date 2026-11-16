import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { FreshnessBadge } from '../../shared/ui/FreshnessBadge';
import { ReliabilityBadge } from '../../shared/ui/ReliabilityBadge';
import { formatPresentation } from '../catalog/presentation';
import { describeCriteria } from './criteria';
import { formatCop, formatUnitPrice } from './money';
import './comparison.css';

type Product = components['schemas']['Product'];
type Comparison = components['schemas']['Comparison'];
type Sort = Comparison['criteria']['sort'];
type Source = components['schemas']['ComparisonItem']['source'];

// Hoy todo es de la comunidad; «oficial» llega con el módulo comercial (Corte 3).
const SOURCE: Record<Source, string> = {
  comunidad: 'Comunidad',
  oficial: 'Precio oficial',
  siembra: 'Dato inicial',
};

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'unit_price', label: 'Precio por unidad' },
  { value: 'recent', label: 'Más recientes' },
  { value: 'distance', label: 'Distancia' },
];

// P7 (neutralidad, EC-06): el orden lo decide el backend con el criterio declarado; la pantalla
// no reordena ni destaca a nadie más que a lo que el backend marca.
export function ComparePrices() {
  const { productId = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [sort, setSort] = useState<Sort>('unit_price');
  // Cada respuesta guarda la consulta que la pidió: una lenta no pisa a una más nueva.
  const [outcome, setOutcome] = useState<{ key: string; comparison: Comparison } | null>(null);
  const key = `${productId}|${sort}`;

  useEffect(() => {
    void call(api.GET('/products/{productId}', { params: { path: { productId } } })).then(
      setProduct,
    );
  }, [productId]);

  useEffect(() => {
    let current = true;
    void call(
      api.GET('/products/{productId}/comparison', {
        params: { path: { productId }, query: { municipality: 'armenia', sort } },
      }),
    ).then((comparison) => {
      if (current) setOutcome({ key, comparison });
    });
    return () => {
      current = false;
    };
  }, [productId, sort, key]);

  if (!product || !outcome) return null;
  const { comparison } = outcome;
  const sizeOf = (presentationId: string) => {
    const presentation = product.presentations.find(({ id }) => id === presentationId);
    return presentation ? formatPresentation(presentation) : '';
  };
  return (
    <section className="compare">
      <h1>{product.name}</h1>
      <fieldset role="radiogroup" className="choices">
        <legend>Ordenar por</legend>
        {SORT_OPTIONS.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name="sort"
              value={option.value}
              checked={sort === option.value}
              // Sin la ubicación no hay distancia: el backend responde 400 a sort=distance.
              disabled={option.value === 'distance'}
              onChange={() => {
                setSort(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <p className="muted">{describeCriteria(comparison.criteria)}</p>
      <ul className="offers">
        {comparison.results.map((offer) => (
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
