import { useEffect, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { MUNICIPALITIES } from '../comparison/criteria';
import { readMunicipality } from '../comparison/lastMunicipality';
import { StoreCard } from './StoreCard';
import { StoreMap } from './StoreMap';
import './stores.css';

type Store = components['schemas']['Establishment'];

// ADR-019: el mapa y la lista de tiendas registradas en Valora. Sin pedir permisos, las del
// municipio elegido (B#116).
export function MapPage() {
  const [municipality] = useState(readMunicipality);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    void call(api.GET('/establishments', { params: { query: { municipality, limit: 50 } } })).then(
      ({ items }) => {
        setStores(items);
      },
    );
  }, [municipality]);

  const where = `Tiendas en ${MUNICIPALITIES[municipality]}`;
  return (
    <section className="stores">
      <h1>{where}</h1>
      <StoreMap stores={stores} label={`Mapa: ${where}`} />
      <ul className="store-cards">
        {stores.map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}
      </ul>
    </section>
  );
}
