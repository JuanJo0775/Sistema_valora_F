import { Link } from 'react-router';
import type { components } from '../../shared/api/schema';
import { directionsTo } from '../../shared/directions';
import { formatDistance } from '../../shared/location';
import { formatCop } from '../../shared/money';
import { STORE_TYPES } from './storeTypes';

type Store = components['schemas']['Establishment'];

// Cuánto costaría aquí lo que falta de la canasta (#31): la suma la hace useStoreTotals.
export interface BasketHere {
  totalCop: number;
  found: number;
  of: number;
}

// #73 (prototipo): una tienda en la lista del mapa, lo mismo que su marcador para quien no usa el
// mapa. El punto lleva el color de su tipo, como el marcador y la leyenda.
export function StoreCard({ store, basket }: { store: Store; basket?: BasketHere }) {
  return (
    <li className="store-card">
      <h2>{store.name}</h2>
      <p className="muted store-kind">
        <span className={`dot type-${store.type}`} aria-hidden="true" />
        <span>{STORE_TYPES[store.type]}</span>
        {store.distanceM !== undefined && <span>{`· ${formatDistance(store.distanceM)}`}</span>}
      </p>
      {basket && (
        <p className="muted">
          Tu canasta aquí: <strong>{formatCop(basket.totalCop)}</strong>
          {` · ${String(basket.found)} de ${String(basket.of)} productos`}
        </p>
      )}
      <div className="store-actions">
        <a
          href={directionsTo(store)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn ghost"
          aria-label={`Cómo llegar a ${store.name}`}
        >
          Cómo llegar
        </a>
        <Link
          to={`/tiendas/${store.id}`}
          className="btn ghost"
          aria-label={`Ver precios de ${store.name}`}
        >
          Ver precios
        </Link>
      </div>
    </li>
  );
}
