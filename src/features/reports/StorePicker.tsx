import { useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import { askLocation, formatDistance } from '../../shared/location';
import type { components } from '../../shared/api/schema';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import './reports.css';

export type Store = components['schemas']['Establishment'];

// RF-005: la ubicación del momento solo sirve para buscar las tiendas cercanas. No se guarda ni va
// en el reporte, que solo lleva la tienda (EC-08).
export function StorePicker({
  value,
  onChange,
  mode = 'report',
}: {
  mode?: 'report' | 'claim';
  value: Store | null;
  onChange: (store: Store) => void;
}) {
  const [stores, setStores] = useState<Store[]>([]);
  const [problem, setProblem] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState('');

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
        // Sin ubicación queda la búsqueda por nombre (B#116).
        () => {
          setProblem('Activa la ubicación del navegador o busca la tienda por su nombre.');
        },
      )
      .finally(() => {
        setSearching(false);
      });
  };

  // B#116: buscar por nombre no pide la ubicación (EC-08).
  const findByName = () => {
    setProblem('');
    setError(null);
    const wanted = name.trim();
    // El contrato pide al menos 2 letras (minLength de q): se avisa sin llamar a la API.
    if (wanted.length < 2) {
      setProblem('Escribe al menos 2 letras del nombre de la tienda.');
      return;
    }
    setSearching(true);
    call(api.GET('/establishments', { params: { query: { q: wanted } } }))
      .then(({ items }) => {
        setStores(items);
        if (items.length === 0) setProblem('No encontramos tiendas con ese nombre.');
      })
      .catch((failure: unknown) => {
        setError(failure);
      })
      .finally(() => {
        setSearching(false);
      });
  };

  return (
    <fieldset role="radiogroup" className="choices stores">
      <legend>Tienda</legend>
      {mode === 'report' && (
        <>
          <button
            type="button"
            className="btn ghost"
            aria-describedby="para-ubicacion"
            onClick={findNearby}
          >
            Usar mi ubicación
          </button>
          <p id="para-ubicacion" className="muted">
            Solo se usa en tu teléfono para buscar las tiendas cercanas; no se guarda ni se publica.
          </p>
        </>
      )}
      {/* Va dentro del formulario del reporte: Enter busca la tienda, no envía el reporte. */}
      <div className="store-search">
        <input
          type="search"
          aria-label="Buscar tienda por nombre"
          placeholder="O busca la tienda por su nombre"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            findByName();
          }}
        />
        <button type="button" className="btn ghost" onClick={findByName} disabled={searching}>
          Buscar tienda
        </button>
      </div>
      {searching && <Loading text="Buscando tiendas…" />}
      {error !== null && <ErrorState error={error} />}
      {problem && (
        <p role="alert" className="banner warn">
          {problem}
        </p>
      )}
      {mode === 'report' && (
        <Link to="/proponer/tienda" className="link-button">
          ¿No está la tienda? Sugiérela
        </Link>
      )}
      {/* La tienda ya elegida (la última usada) aparece aunque no se haya pedido la ubicación. */}
      <div className="store-list">
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
            <span>
              {store.name}
              {mode === 'claim' && store.address && (
                <small className="muted">{store.address}</small>
              )}
            </span>
            {store.distanceM !== undefined && (
              <span className="muted">{formatDistance(store.distanceM)}</span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const withChosen = (stores: Store[], chosen: Store | null) =>
  chosen && !stores.some(({ id }) => id === chosen.id) ? [chosen, ...stores] : stores;
