import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { formatPresentation } from './presentation';
import { ProductThumb } from './ProductThumb';
import { SearchSuggest } from './SearchSuggest';
import './catalog.css';

type Product = components['schemas']['Product'];

// Resultado de una búsqueda, marcado con la búsqueda que lo pidió (texto e intento).
type Outcome = { key: string; products: Product[] } | { key: string; error: unknown };

const BARCODE = /^\d{8,14}$/;

// El texto buscado vive en la dirección (?q=): «atrás» vuelve a los mismos resultados.
// Por defecto cada resultado lleva a su detalle; el registro de precios lo trae de vuelta a sí mismo.
export function ProductSearch({
  linkTo = (productId) => `/productos/${productId}`,
  formClassName = 'search',
}: {
  linkTo?: (productId: string) => string;
  // El Inicio esconde su formulario en escritorio, donde el buscador está en la barra (#48).
  formClassName?: string;
}) {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
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

  // Enter sin elegir sugerencia: busca lo escrito.
  const search = (wanted: string) => {
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
      {/* #83: mientras se escribe, sugiere productos. */}
      <SearchSuggest
        label="Buscar producto"
        initial={query}
        formClassName={formClassName}
        onSearch={search}
        linkTo={linkTo}
        submitLabel="Buscar"
      />
      {hint && <p className="muted">{hint}</p>}
      {query && !result && <Loading text="Buscando…" />}
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
          action={
            // #12: proponerlo, con el nombre que se buscó (pide sesión de reportante).
            <Link
              to={`/proponer/producto?${new URLSearchParams({ nombre: query }).toString()}`}
              className="btn ghost"
            >
              Propón este producto
            </Link>
          }
        />
      )}
      {result && 'products' in result && (
        <ul className="results">
          {result.products.map((product) => (
            <li key={product.id}>
              <Link to={linkTo(product.id)} className="result">
                <ProductThumb image={product.image} size="row" />
                <span className="result-text">
                  <strong>{product.name}</strong>
                  <span className="muted">
                    {[product.brand, product.category.name].filter(Boolean).join(' · ')}
                  </span>
                  <span className="muted">
                    {product.presentations.map(formatPresentation).join(', ')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
