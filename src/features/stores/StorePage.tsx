import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Icon } from '../../app/Icon';
import { api, ApiError, call } from '../../shared/api';
import type { paths } from '../../shared/api/schema';
import { directionsTo } from '../../shared/directions';
import { formatCop, formatUnitPrice } from '../../shared/money';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { FreshnessBadge } from '../../shared/ui/FreshnessBadge';
import { ReliabilityBadge } from '../../shared/ui/ReliabilityBadge';
import { Skeleton } from '../../shared/ui/Skeleton';
import { ProductThumb } from '../catalog/ProductThumb';
import { MUNICIPALITIES } from '../comparison/criteria';
import { PinShape } from './pinShapes';
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
  if (!result) return <StorePageSkeleton />;
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
  // El contrato aún no declara el barrio; si el API lo manda, se muestra (ver notas de la tarea).
  const { neighborhood } = store as typeof store & { neighborhood?: string };
  const place = [MUNICIPALITIES[store.municipality], neighborhood].filter(Boolean).join(' · ');
  const count = prices.length;
  // El filtro solo aparece si hay precios; si se filtró hasta quedar sin nada, sigue para quitarlo.
  const showFilter = count > 0 || onlyCurrent;
  return (
    <div className="with-side store-page stores">
      <div className="store-top">
        <BackLink fallback="/mapa" />
        <header className="store-head" aria-labelledby="tienda-nombre">
          <h1 id="tienda-nombre">{store.name}</h1>
          <p className={`pill mute store-type type-${store.type}`}>
            <PinShape type={store.type} />
            {STORE_TYPES[store.type]}
          </p>
          <p className="store-address">{store.address ?? 'Sin dirección registrada'}</p>
          <p className="muted store-place">{place}</p>
          <div className="store-head-actions">
            <a
              href={directionsTo(store)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Cómo llegar a ${store.name}`}
              className="btn"
            >
              <Icon name="map" />
              Cómo llegar
            </a>
            <Link to={`/registrar?tienda=${store.id}`} className="btn ghost">
              <Icon name="plus" />
              Registrar un precio aquí
            </Link>
            <Link to={`/comercios/registro?tienda=${store.id}`} className="btn ghost">
              ¿Eres el dueño? Registra tu tienda
            </Link>
          </div>
        </header>
      </div>
      <aside className="side store-side" aria-labelledby="tienda-ubicacion">
        <section className="store-card-box">
          <h2 id="tienda-ubicacion">Ubicación</h2>
          <StoreMap stores={[store]} label={`Mapa: ${store.name}`} />
        </section>
      </aside>
      <section className="store-prices" aria-labelledby="tienda-precios">
        <div className="store-prices-head">
          <h2 id="tienda-precios">Precios</h2>
          {count > 0 && (
            <p className="muted store-count">
              {`${String(count)} ${count === 1 ? 'producto con precio' : 'productos con precio'}`}
            </p>
          )}
          {showFilter && (
            <label className="store-filter">
              <input
                type="checkbox"
                checked={onlyCurrent}
                onChange={(event) => {
                  setOnlyCurrent(event.target.checked);
                }}
              />
              Solo precios vigentes
            </label>
          )}
        </div>
        {count === 0 ? (
          <NoPrices onlyCurrent={onlyCurrent} storeId={store.id} />
        ) : (
          <ul className="offers store-offers">
            {prices.map((price) => (
              <li key={price.presentationId} className="offer store-offer">
                <ProductThumb size="row" />
                <div className="store-offer-body">
                  <h3>
                    <Link to={`/productos/${price.productId}`}>{price.productName}</Link>
                  </h3>
                  <p className="badges">
                    <FreshnessBadge freshness={price.freshness} observedAt={price.observedAt} />
                    {price.reliability && <ReliabilityBadge level={price.reliability} />}
                  </p>
                </div>
                <div className="store-offer-price">
                  <p className="offer-price">{formatCop(price.priceCop)}</p>
                  <p className="unit">{formatUnitPrice(price.unitPrice)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Una tienda sin precios invita a poner el primero; con el filtro puesto, a quitarlo.
function NoPrices({ onlyCurrent, storeId }: { onlyCurrent: boolean; storeId: string }) {
  return (
    <div className="store-empty">
      <svg
        className="store-art"
        viewBox="0 0 64 64"
        width="72"
        height="72"
        aria-hidden="true"
        focusable="false"
      >
        <path className="art-body" d="M10 26l4-14h36l4 14z" />
        <path
          className="art-line"
          d="M12 26v26h40V26M10 26c0 4 4 6 7 6s7-2 7-6c0 4 4 6 7 6s7-2 7-6c0 4 4 6 7 6s7-2 7-6"
        />
        <path className="art-line" d="M26 52V40h12v12" />
      </svg>
      {onlyCurrent ? (
        <>
          <h3>No hay precios vigentes</h3>
          <p className="muted">Quita el filtro para ver los precios que ya se vencieron.</p>
        </>
      ) : (
        <>
          <h3>Aún no hay precios aquí</h3>
          <p className="muted">Nadie ha reportado un precio en esta tienda todavía.</p>
          <Link to={`/registrar?tienda=${storeId}`} className="btn">
            <Icon name="plus" />
            Sé el primero en registrar un precio
          </Link>
        </>
      )}
    </div>
  );
}

// Misma forma que la página: tarjeta de encabezado, mapa y filas de precios, sin saltos al cargar.
function StorePageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="skeleton-wrap">
      <span className="sr-only">Cargando…</span>
      <div className="with-side store-page" aria-hidden="true">
        <div className="store-top">
          <Skeleton width="4rem" />
          <div className="store-head">
            <Skeleton width="60%" height="1.8rem" />
            <Skeleton width="8rem" height="1.4rem" />
            <Skeleton width="75%" />
            <Skeleton width="40%" />
            <Skeleton variant="block" className="skeleton-button" />
          </div>
        </div>
        <div className="side store-side">
          <Skeleton variant="block" className="skeleton-store-map" />
        </div>
        <ul className="offers store-prices">
          {[0, 1, 2].map((item) => (
            <li key={item} className="offer store-offer">
              <Skeleton variant="block" className="thumb-row" />
              <span className="skeleton-lines">
                <Skeleton width="60%" />
                <Skeleton width="40%" />
              </span>
              <Skeleton width="4.5rem" height="1.15rem" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
