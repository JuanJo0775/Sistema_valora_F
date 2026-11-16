import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { formatPresentation } from '../catalog/presentation';
import { Offer } from './Offer';
import './comparison.css';

type Product = components['schemas']['Product'];
type Comparison = components['schemas']['Comparison'];

const SHOWN = 3;

// #43: un adelanto de la comparación en el detalle del producto. Mismo orden declarado que la
// comparación (precio por unidad, EC-06) y solo precios vigentes; el resto, en «Ver todas».
export function CheapestOffers({ product }: { product: Product }) {
  const [comparison, setComparison] = useState<Comparison | null>(null);

  useEffect(() => {
    call(
      api.GET('/products/{productId}/comparison', {
        params: {
          path: { productId: product.id },
          query: { municipality: 'armenia', sort: 'unit_price', onlyCurrent: true },
        },
      }),
    )
      .then(setComparison)
      // Si la comparación falla, el detalle del producto se sigue viendo.
      .catch(() => undefined);
  }, [product.id]);

  if (!comparison) return null;
  const sizeOf = (presentationId: string) => {
    const presentation = product.presentations.find(({ id }) => id === presentationId);
    return presentation ? formatPresentation(presentation) : '';
  };
  return (
    <section className="cheapest">
      <h2 id="mas-baratos">Más baratos en Armenia</h2>
      <ul aria-labelledby="mas-baratos" className="offers">
        {comparison.results.slice(0, SHOWN).map((offer) => (
          <Offer key={offer.reportId} offer={offer} size={sizeOf(offer.presentationId)} />
        ))}
      </ul>
      <Link to={`/productos/${product.id}/comparar`}>Ver todas las tiendas</Link>
    </section>
  );
}
