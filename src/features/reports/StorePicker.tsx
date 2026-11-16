import { useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';

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

  const findNearby = () => {
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      void call(
        api.GET('/establishments/nearby', {
          params: { query: { lat: coords.latitude, lng: coords.longitude } },
        }),
      ).then(({ items }) => {
        setStores(items);
      });
    });
  };

  return (
    <fieldset role="radiogroup" className="choices stores">
      <legend>Tienda</legend>
      <button type="button" className="btn ghost" onClick={findNearby}>
        Usar mi ubicación
      </button>
      {stores.map((store) => (
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
