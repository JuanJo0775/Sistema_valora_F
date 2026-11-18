import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import type { paths } from '../../shared/api/schema';
import { directionsTo } from '../../shared/directions';
import { formatCop, formatUnitPrice } from '../../shared/money';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { FreshnessBadge } from '../../shared/ui/FreshnessBadge';
import { Loading } from '../../shared/ui/Loading';
import { ReliabilityBadge } from '../../shared/ui/ReliabilityBadge';
import { MUNICIPALITIES } from '../comparison/criteria';
import { StoreMap } from './StoreMap';
import { STORE_TYPES } from './storeTypes';
import './stores.css';
import { BackLink } from '../../shared/ui/BackLink';

type StorePrices =
  paths['/establishments/{establishmentId}/prices']['get']['responses'][200]['content']['application/json'];

// #18 (RF-008): una tienda con todos sus precios, cada uno con su vigencia y su confiabilidad,
// como en la comparación. El orden (por producto) lo da el backend.
export function StorePage() {
  const { establishmentId = '' } = useParams();
  const [onlyCurrent, setOnlyCurrent] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = `${establishmentId}|${String(onlyCurrent)}|${String(attempt)}`;
  const [outcome, setOutcome] = useState<
    { key: string; data: StorePrices } | { key: string; error: unknown } | null
  >(null);

  useEffect(() => {
    let current = true;
    call(
      api.GET('/establishments/{establishmentId}/prices', {
        params: { path: { establishmentId }, query: { onlyCurrent } },
      }),
    )
      .then((data) => {
        if (current) setOutcome({ key, data });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    return () => {
      current = false;
    };
  }, [establishmentId, onlyCurrent, key]);

  // Al cambiar «Solo vigentes» se siguen viendo los datos anteriores hasta que lleguen los nuevos.
  const result = outcome && (outcome.key === key || 'data' in outcome) ? outcome : null;
  if (!result) return <Loading />;
  if ('error' in result) {
    if (result.error instanceof ApiError && result.error.status === 404) {
      return (
        <EmptyState
          title="No encontramos esta tienda"
          action={
            <Link to="/mapa" className="btn ghost">
              Ver el mapa de tiendas
            </Link>
          }
        />
      );
    }
    return (
      <ErrorState
        error={result.error}
        onRetry={() => {
          setAttempt((count) => count + 1);
        }}
      />
    );
  }
  const { establishment: store, prices } = result.data;
  return (
    <div className="with-side">
      <section className="stores">
        <BackLink fallback="/mapa" />
        <h1>{store.name}</h1>
        <p className="muted">
          {[STORE_TYPES[store.type], store.address, MUNICIPALITIES[store.municipality]]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {/* H-10: en el celular el mapa queda al final; quien solo quiere ir a la tienda no cruza la lista. */}
        <a
          href={directionsTo(store)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Cómo llegar a ${store.name}`}
          className="btn store-directions"
        >
          Cómo llegar
        </a>
        <label className="check">
          <input
            type="checkbox"
            checked={onlyCurrent}
            onChange={(event) => {
              setOnlyCurrent(event.target.checked);
            }}
          />
          Solo precios vigentes
        </label>
        {prices.length === 0 && <p className="muted">Todavía no hay precios en esta tienda.</p>}
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
      </aside>
    </div>
  );
}
