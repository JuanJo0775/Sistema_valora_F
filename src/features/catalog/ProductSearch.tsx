import { type SyntheticEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { formatPresentation } from './presentation';
import './catalog.css';

type Product = components['schemas']['Product'];

const BARCODE = /^\d{8,14}$/;

// El texto buscado vive en la dirección (?q=): «atrás» vuelve a los mismos resultados.
export function ProductSearch() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [text, setText] = useState(query);
  const [products, setProducts] = useState<Product[]>([]);
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!query) return;
    // RF-003: el código de barras (EAN/GTIN) se escribe o se escanea; tiene de 8 a 14 dígitos.
    const filter = BARCODE.test(query) ? { barcode: query } : { q: query };
    void call(api.GET('/products', { params: { query: filter } })).then(({ items }) => {
      setProducts(items);
    });
  }, [query]);

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
