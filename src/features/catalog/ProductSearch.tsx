import { type SyntheticEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { formatPresentation } from './presentation';
import './catalog.css';

type Product = components['schemas']['Product'];

// Resultado de una búsqueda, marcado con la búsqueda que lo pidió (texto e intento).
type Outcome = { key: string; products: Product[] } | { key: string; error: unknown };

const BARCODE = /^\d{8,14}$/;

// El texto buscado vive en la dirección (?q=): «atrás» vuelve a los mismos resultados.
export function ProductSearch() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [text, setText] = useState(query);
  const [hint, setHint] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const key = `${query}|${String(attempt)}`;

  useEffect(() => {
    if (!query) return;
    let current = true;
    // RF-003: el código de barras (EAN/GTIN) se escribe o se escanea; tiene de 8 a 14 dígitos.
    const filter = BARCODE.test(query) ? { barcode: query } : { q: query };
    call(api.GET('/products', { params: { query: filter } }))
      .then(({ items }) => {
        if (current) setOutcome({ key, products: items });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    // Una respuesta que llega tarde no reemplaza la de una búsqueda más nueva.
    return () => {
      current = false;
    };
  }, [query, key]);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const wanted = text.trim();
    // El contrato pide al menos 2 letras (minLength de q): se avisa sin llamar a la API.
    if (wanted.length < 2) {
      setHint('Escribe al menos 2 letras.');
      return;
    }
    setHint('');
    setParams({ q: wanted });
  };

  const result = query && outcome?.key === key ? outcome : null;

  return (
    <>
      <form role="search" className="search" onSubmit={submit}>
        <input
          type="search"
          aria-label="Buscar producto"
          placeholder="Busca arroz, leche, huevos…"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <button type="submit" className="btn">
          Buscar
        </button>
      </form>
      {hint && <p className="muted">{hint}</p>}
      {result && 'error' in result && (
        <ErrorState
          error={result.error}
          onRetry={() => {
            setAttempt((current) => current + 1);
          }}
        />
      )}
      {result && 'products' in result && result.products.length === 0 && (
        <EmptyState
          title={`Sin resultados para «${query}»`}
          text="Revisa la escritura o pide que lo agreguemos al catálogo."
        />
      )}
      {result && 'products' in result && (
        <ul className="results">
          {result.products.map((product) => (
            <li key={product.id}>
              <Link to={`/productos/${product.id}`} className="result">
                <strong>{product.name}</strong>
                <span className="muted">
                  {[product.brand, product.category.name].filter(Boolean).join(' · ')}
                </span>
                <span className="muted">
                  {product.presentations.map(formatPresentation).join(', ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
