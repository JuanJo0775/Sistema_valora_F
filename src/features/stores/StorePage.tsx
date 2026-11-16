import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { paths } from '../../shared/api/schema';
import { directionsTo } from '../../shared/directions';
import { formatCop, formatUnitPrice } from '../../shared/money';
import { FreshnessBadge } from '../../shared/ui/FreshnessBadge';
import { ReliabilityBadge } from '../../shared/ui/ReliabilityBadge';
import { MUNICIPALITIES } from '../comparison/criteria';
import { StoreMap } from './StoreMap';
import { STORE_TYPES } from './storeTypes';
import './stores.css';

type StorePrices =
  paths['/establishments/{establishmentId}/prices']['get']['responses'][200]['content']['application/json'];

// #18 (RF-008): una tienda con todos sus precios, cada uno con su vigencia y su confiabilidad,
// como en la comparación. El orden (por producto) lo da el backend.
export function StorePage() {
  const { establishmentId = '' } = useParams();
  const [data, setData] = useState<StorePrices | null>(null);

  useEffect(() => {
    void call(
      api.GET('/establishments/{establishmentId}/prices', {
        params: { path: { establishmentId } },
      }),
    ).then(setData);
  }, [establishmentId]);

  if (!data) return null;
  const { establishment: store, prices } = data;
  return (
    <div className="with-side">
      <section className="stores">
        <h1>{store.name}</h1>
        <p className="muted">
          {[STORE_TYPES[store.type], store.address, MUNICIPALITIES[store.municipality]]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <ul className="offers">
          {prices.map((price) => (
            <li key={price.reportId} className="offer">
              <h2>
                <Link to={`/productos/${price.productId}`}>{price.productName}</Link>
              </h2>
              <p>{formatCop(price.priceCop)}</p>
              <p className="unit">{formatUnitPrice(price.unitPrice)}</p>
              <p className="badges">
                <FreshnessBadge freshness={price.freshness} observedAt={price.observedAt} />
                <ReliabilityBadge level={price.reliability} />
              </p>
            </li>
          ))}
        </ul>
      </section>
      <aside className="side" aria-label="Dónde queda">
        <StoreMap stores={[store]} label={`Mapa: ${store.name}`} />
        <a
          href={directionsTo(store)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Cómo llegar a ${store.name}`}
          className="btn"
        >
          Cómo llegar
        </a>
      </aside>
    </div>
  );
}
