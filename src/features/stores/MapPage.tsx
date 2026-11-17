import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { MUNICIPALITIES } from '../comparison/criteria';
import { useWhere, WhereChooser } from '../comparison/WhereChooser';
import { StoreCard } from './StoreCard';
import { StoreMap } from './StoreMap';
import './stores.css';

type Store = components['schemas']['Establishment'];

// El contrato devuelve hasta 50 tiendas por municipio (parámetro Limit).
const LIMIT = 50;

// ADR-019: el mapa y la lista de tiendas registradas en Valora. Sin pedir permisos, las del
// municipio elegido (B#116); con la ubicación, las cercanas en un radio.
export function MapPage() {
  const where = useWhere();
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<
    { key: string; stores: Store[] } | { key: string; error: unknown } | null
  >(null);
  const key = `${String(attempt)}|${where.key}`;

  useEffect(() => {
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
  }, [where.query, key]);

  const result = outcome?.key === key ? outcome : null;
  const place = where.point ? 'cerca de ti' : `en ${MUNICIPALITIES[where.municipality]}`;
  const stores = result && 'stores' in result ? result.stores : [];
  return (
    <section className="stores">
      <h1>{`Tiendas ${place}`}</h1>
      <WhereChooser where={where} backLabel="Ver por municipio" />
      <StoreMap stores={stores} label={`Mapa de las tiendas ${place}`} />
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
      {stores.length === LIMIT && (
        <p className="muted">{`Se muestran ${String(LIMIT)} tiendas. Usa tu ubicación para ver las más cercanas.`}</p>
      )}
      {/* #12: una tienda que nadie ha registrado se sugiere; la revisa un moderador. */}
      <Link to="/proponer/tienda" className="link-button">
        Sugerir una tienda que no aparece
      </Link>
      <ul className="store-cards">
        {stores.map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}
      </ul>
    </section>
  );
}
