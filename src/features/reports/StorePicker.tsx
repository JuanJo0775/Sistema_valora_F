import { useState } from 'react';
import { api, call } from '../../shared/api';
import { askLocation } from '../../shared/location';
import type { components } from '../../shared/api/schema';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';

export type Store = components['schemas']['Establishment'];

const KM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const distance = (meters: number) =>
  meters < 1000 ? `${String(meters)} m` : `${KM.format(meters / 1000)} km`;

// RF-005: la ubicación del momento solo sirve para buscar las tiendas cercanas. No se guarda ni va
// en el reporte, que solo lleva la tienda (EC-08).
export function StorePicker({
  value,
  onChange,
}: {
  value: Store | null;
  onChange: (store: Store) => void;
}) {
  const [stores, setStores] = useState<Store[]>([]);
  const [problem, setProblem] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [searching, setSearching] = useState(false);

  const findNearby = () => {
    setProblem('');
    setError(null);
    setSearching(true);
    askLocation()
      .then(
        (point) =>
          call(api.GET('/establishments/nearby', { params: { query: point } }))
            .then(({ items }) => {
              setStores(items);
              if (items.length === 0) setProblem('No hay tiendas registradas cerca de ti.');
            })
            .catch((failure: unknown) => {
              setError(failure);
            }),
        // Sin ubicación todavía no hay otra forma de elegir la tienda (llega con B#116).
        () => {
          setProblem('Activa la ubicación del navegador para ver las tiendas cercanas.');
        },
      )
      .finally(() => {
        setSearching(false);
      });
  };

  return (
    <fieldset role="radiogroup" className="choices stores">
      <legend>Tienda</legend>
      <button type="button" className="btn ghost" onClick={findNearby}>
        Usar mi ubicación
      </button>
      {searching && <Loading text="Buscando tiendas…" />}
      {error !== null && <ErrorState error={error} />}
      {problem && (
        <p role="alert" className="banner warn">
          {problem}
        </p>
      )}
      {/* La tienda ya elegida (la última usada) aparece aunque no se haya pedido la ubicación. */}
      {withChosen(stores, value).map((store) => (
        <label key={store.id} className="choice store">
          <input
            type="radio"
            name="store"
            value={store.id}
            checked={value?.id === store.id}
            onChange={() => {
              onChange(store);
            }}
          />
          <span>{store.name}</span>
          {store.distanceM !== undefined && (
            <span className="muted">{distance(store.distanceM)}</span>
          )}
        </label>
      ))}
    </fieldset>
  );
}

const withChosen = (stores: Store[], chosen: Store | null) =>
  chosen && !stores.some(({ id }) => id === chosen.id) ? [chosen, ...stores] : stores;
