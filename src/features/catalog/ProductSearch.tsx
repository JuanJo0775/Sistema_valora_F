import { type SyntheticEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { formatPresentation } from './presentation';
import './catalog.css';

type Product = components['schemas']['Product'];

// El texto buscado vive en la dirección (?q=): «atrás» vuelve a los mismos resultados.
export function ProductSearch() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [text, setText] = useState(query);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!query) return;
    void call(api.GET('/products', { params: { query: { q: query } } })).then(({ items }) => {
      setProducts(items);
    });
  }, [query]);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setParams({ q: text.trim() });
  };

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
      <ul className="results">
        {products.map((product) => (
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
    </>
  );
}
