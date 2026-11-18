import { type KeyboardEvent, type SyntheticEvent, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { ProductThumb } from './ProductThumb';
import { formatPresentation } from './presentation';
import './catalog.css';

type Product = components['schemas']['Product'];

const MIN_LETTERS = 2;
const PAUSE_MS = 250;
const SHOWN = 6;

const toResults = (text: string) => `/?${new URLSearchParams({ q: text }).toString()}`;

// #83: el buscador sugiere productos mientras se escribe (RF-003), con el patrón combobox de
// WAI-ARIA: flechas para recorrer, Enter para abrir el elegido, Escape para cerrar. Pide al servidor
// después de una pausa corta, y una respuesta tardía no reemplaza la de lo último que se escribió.
export function SearchSuggest({
  label,
  placeholder = 'Busca arroz, leche, huevos…',
  initial = '',
  formClassName = 'search',
  onSearch,
  linkTo = (productId) => `/productos/${productId}`,
  submitLabel,
}: {
  label: string;
  placeholder?: string;
  initial?: string;
  formClassName?: string;
  // Enter sin elegir sugerencia. Por defecto, los resultados del Inicio (/?q=…).
  onSearch?: (text: string) => void;
  // A dónde lleva una sugerencia. El registro de precios la trae de vuelta a sí mismo.
  linkTo?: (productId: string) => string;
  // El botón de buscar, cuando la pantalla lo muestra (el Inicio en el celular).
  submitLabel?: string;
}) {
  const navigate = useNavigate();
  const base = useId();
  const [text, setText] = useState(initial);
  const [found, setFound] = useState<{ query: string; items: Product[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const query = text.trim();

  useEffect(() => {
    // Un código de barras (solo números) se busca con Enter, sin sugerencias.
    if (query.length < MIN_LETTERS || /^\d+$/.test(query)) return;
    let current = true;
    const timer = window.setTimeout(() => {
      call(api.GET('/products', { params: { query: { q: query } } }))
        .then(({ items }) => {
          if (current) setFound({ query, items: items.slice(0, SHOWN) });
        })
        // Sin red o con un error, simplemente no hay sugerencias: buscar sigue funcionando.
        .catch(() => undefined);
    }, PAUSE_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const items = found?.query === query && query.length >= MIN_LETTERS ? found.items : null;
  const showing = open && items !== null;
  const optionId = (index: number) => `${base}-opcion-${String(index)}`;

  const openProduct = (product: Product) => {
    setOpen(false);
    void navigate(linkTo(product.id));
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setOpen(false);
    if (onSearch) onSearch(query);
    else if (query) void navigate(toResults(query));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!items || items.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + items.length) % items.length);
      return;
    }
    const chosen = items[active];
    if (event.key === 'Enter' && showing && chosen) {
      event.preventDefault();
      openProduct(chosen);
    }
  };

  return (
    <form role="search" aria-label={label} className={formClassName} onSubmit={submit}>
      <div className="suggest">
        <input
          type="search"
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={showing}
          aria-controls={`${base}-lista`}
          aria-activedescendant={showing && active >= 0 ? optionId(active) : undefined}
          placeholder={placeholder}
          autoComplete="off"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false);
          }}
        />
        {showing && items.length > 0 && (
          <ul id={`${base}-lista`} role="listbox" aria-label="Sugerencias" className="suggest-list">
            {items.map((product, index) => (
              <li
                key={product.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                className="suggest-option"
                // Sin perder el foco del campo, para que el toque llegue al clic.
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  openProduct(product);
                }}
              >
                <ProductThumb image={product.image} size="row" category={product.category.code} />
                <span className="suggest-text">
                  <span className="suggest-name">{product.name}</span>
                  <span className="muted">
                    {[product.brand, product.presentations.map(formatPresentation).join(', ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {showing && items.length === 0 && (
          <p className="suggest-list suggest-empty muted">{`Sin sugerencias para «${query}»`}</p>
        )}
        <p className="sr-only" aria-live="polite">
          {showing && items.length > 0
            ? `${String(items.length)} ${items.length === 1 ? 'sugerencia' : 'sugerencias'}`
            : ''}
        </p>
      </div>
      {submitLabel && (
        <button type="submit" className="btn">
          {submitLabel}
        </button>
      )}
    </form>
  );
}
