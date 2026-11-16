import { Link } from 'react-router';
import type { components } from '../../shared/api/schema';
import { directionsTo } from '../../shared/directions';
import { formatDistance } from '../../shared/location';
import { STORE_TYPES } from './storeTypes';

type Store = components['schemas']['Establishment'];

// Una tienda en la lista del mapa: lo mismo que su marcador, para quien no usa el mapa.
export function StoreCard({ store }: { store: Store }) {
  return (
    <li className="store-card">
      <h2>{store.name}</h2>
      <p className="muted">
        {[STORE_TYPES[store.type], store.distanceM !== undefined && formatDistance(store.distanceM)]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <div className="actions">
        <Link
          to={`/tiendas/${store.id}`}
          className="btn ghost"
          aria-label={`Ver precios de ${store.name}`}
        >
          Ver precios
        </Link>
        <a
          href={directionsTo(store)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Cómo llegar a ${store.name}`}
        >
          Cómo llegar
        </a>
      </div>
    </li>
  );
}
