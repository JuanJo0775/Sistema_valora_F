import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { operations } from '../../shared/api/schema';
import { formatCop, formatUnitPrice } from '../../shared/money';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { SelectField } from '../../shared/ui/SelectField';
import { type Municipality, MUNICIPALITIES, MUNICIPALITY_OPTIONS } from './criteria';
import { readMunicipality, saveMunicipality } from './lastMunicipality';
import '../catalog/catalog.css';
import './comparison.css';

type Featured =
  operations['listFeaturedProducts']['responses'][200]['content']['application/json']['items'][number];

const FEW = 5;
const MORE = 20;

const stores = (count: number) =>
  `Con precio en ${String(count)} ${count === 1 ? 'tienda' : 'tiendas'}`;

// #61 (RF-008 y RF-009): en el Inicio, los productos con precio en más tiendas del municipio y
// el más bajo de cada uno. El orden y el precio los decide el backend (B#120); el criterio se
// dice en pantalla (EC-06).
export function TodayBasket() {
  const [municipality, setMunicipality] = useState<Municipality>(readMunicipality);
  const [limit, setLimit] = useState(FEW);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<
    { key: string; items: Featured[] } | { key: string; error: unknown } | null
  >(null);
  const key = `${municipality}|${String(limit)}|${String(attempt)}`;

  useEffect(() => {
    let current = true;
    call(api.GET('/featured-products', { params: { query: { municipality, limit } } }))
      .then(({ items }) => {
        if (current) setOutcome({ key, items });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    return () => {
      current = false;
    };
  }, [municipality, limit, key]);

  const result = outcome?.key === key ? outcome : null;
  const place = MUNICIPALITIES[municipality];
  return (
    <section className="today-basket" aria-labelledby="today-basket">
      <h2 id="today-basket">Canasta básica de hoy</h2>
      <SelectField
        label="Municipio"
        value={municipality}
        options={MUNICIPALITY_OPTIONS}
        onChange={(chosen) => {
          saveMunicipality(chosen);
          setLimit(FEW);
          setMunicipality(chosen);
        }}
      />
      <p className="muted">{`Los productos con precio en más tiendas de ${place}.`}</p>
      {!result && <Loading />}
      {result && 'error' in result && (
        <ErrorState
          error={result.error}
          onRetry={() => {
            setAttempt((count) => count + 1);
          }}
        />
      )}
      {result && 'items' in result && result.items.length === 0 && (
        <p className="muted">{`Todavía no hay precios en ${place}. Registra el primero.`}</p>
      )}
      {result && 'items' in result && (
        <>
          <ul className="results">
            {result.items.map((product) => (
              <li key={product.productId}>
                <Link to={`/productos/${product.productId}`} className="result">
                  <h3>{product.name}</h3>
                  <strong className="price">{`Desde ${formatCop(product.cheapest.priceCop)}`}</strong>
                  <span className="muted">
                    {`${product.cheapest.label} en ${product.cheapest.establishment.name} · ${formatUnitPrice(product.cheapest.unitPrice)}`}
                  </span>
                  <span className="muted">{stores(product.storeCount)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {limit === FEW && result.items.length === FEW && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setLimit(MORE);
              }}
            >
              Ver más
            </button>
          )}
        </>
      )}
    </section>
  );
}
