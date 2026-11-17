import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { MUNICIPALITIES } from '../comparison/criteria';
import { useWhere, WhereChooser } from '../comparison/WhereChooser';
import { useBasket } from '../basket/basketContext';
import { useStoreTotals } from '../basket/useStoreTotals';
import { StoreCard } from './StoreCard';
import { StoreMap } from './StoreMap';
import { STORE_TYPES } from './storeTypes';
import './stores.css';

type Store = components['schemas']['Establishment'];

// El contrato devuelve hasta 50 tiendas por municipio (parámetro Limit).
const LIMIT = 50;
const KM = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ADR-019: el mapa y la lista de tiendas registradas en Valora. Sin pedir permisos, las del
// municipio elegido (B#116); con la ubicación, las cercanas en un radio.
export function MapPage() {
  const where = useWhere();
  // #73: «Tu canasta aquí» en cada tarjeta, con las mismas cuentas de la canasta.
  const { items } = useBasket();
  const { totals } = useStoreTotals(items);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<
    { key: string; stores: Store[] } | { key: string; error: unknown } | null
  >(null);
  const key = `${String(attempt)}|${where.key}`;

  useEffect(() => {
    if (!where.ready) return;
    let current = true;
    const request =
      'municipality' in where.query
        ? api.GET('/establishments', {
            params: { query: { municipality: where.query.municipality, limit: LIMIT } },
          })
        : api.GET('/establishments/nearby', { params: { query: where.query } });
    call(request)
      .then(({ items }) => {
        if (current) setOutcome({ key, stores: items });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    return () => {
      current = false;
    };
  }, [where.ready, where.query, key]);

  const result = outcome?.key === key ? outcome : null;
  const place = where.point ? 'cerca de ti' : `en ${MUNICIPALITIES[where.municipality]}`;
  const stores = result && 'stores' in result ? result.stores : [];
  // El círculo del radio alrededor de la persona; un objeto estable para no redibujar el mapa.
  const { point, radiusKm } = where;
  const around = useMemo(() => (point ? { ...point, radiusKm } : null), [point, radiusKm]);
  const count = stores.length;
  // Una sola frase arriba: cuántas tiendas, o que se muestran las primeras 50 del municipio.
  const subtitle = !(result && 'stores' in result && count > 0)
    ? null
    : !where.point && count === LIMIT
      ? `Se muestran ${String(LIMIT)} tiendas de ${MUNICIPALITIES[where.municipality]}. Usa tu ubicación para ver las más cercanas.`
      : `${String(count)} ${count === 1 ? 'tienda registrada' : 'tiendas registradas'} en Valora ${
          where.point
            ? `a menos de ${KM.format(where.radiusKm)} km. Tu ubicación no se guarda.`
            : `en ${MUNICIPALITIES[where.municipality]}.`
        }`;
  const basketAt = (storeId: string) => {
    if (totals.status !== 'ready') return undefined;
    const here = totals.totals.find(({ store }) => store.id === storeId);
    return here && { totalCop: here.totalCop, found: here.found, of: totals.pending };
  };
  return (
    <div className="with-side stores">
      <section className="stores-main">
        <h1>{`Tiendas ${place}`}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        <WhereChooser where={where} backLabel="Ver por municipio" />
        <StoreMap stores={stores} label={`Mapa de las tiendas ${place}`} around={around} />
        <ul className="map-legend" aria-label="Colores del mapa">
          {Object.entries(STORE_TYPES).map(([type, name]) => (
            <li key={type}>
              <span className={`dot type-${type}`} aria-hidden="true" />
              {name}
            </li>
          ))}
        </ul>
      </section>
      <aside className="side store-list" aria-label="Lista de tiendas">
        {/* #12: una tienda que nadie ha registrado se sugiere; la revisa un moderador. */}
        <Link to="/proponer/tienda" className="btn ghost suggest-store">
          Sugerir una tienda que no aparece
        </Link>
        {!result && <Loading text="Buscando tiendas…" />}
        {result && 'error' in result && (
          <ErrorState
            error={result.error}
            onRetry={() => {
              setAttempt((count) => count + 1);
            }}
          />
        )}
        {result && 'stores' in result && stores.length === 0 && (
          <p className="muted">{`Todavía no hay tiendas registradas ${place}.`}</p>
        )}
        <ul className="store-cards">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} basket={basketAt(store.id)} />
          ))}
        </ul>
      </aside>
    </div>
  );
}
