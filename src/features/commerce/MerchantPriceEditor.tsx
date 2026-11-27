import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { ErrorState } from '../../shared/ui/ErrorState';
import { ResultsStatus } from '../../shared/ui/ResultsStatus';
import { Field } from '../auth/Field';
import { formatPresentation } from '../catalog/presentation';

export interface PriceSelection {
  presentationId: string;
  label: string;
  priceCop: number | undefined;
}

type Product = components['schemas']['Product'];
const BARCODE = /^\d{8,14}$/;
const MIN_LETTERS = 2;
// Pausa tras la última tecla antes de preguntar al catálogo (igual que el buscador de la cabecera).
const PAUSE_MS = 250;

const catalogFilter = (text: string) => (BARCODE.test(text) ? { barcode: text } : { q: text });

export function MerchantPriceEditor({
  selection,
  disabled,
  onChoose,
  onCancel,
  onSave,
}: {
  selection: PriceSelection | null;
  disabled: boolean;
  onChoose: (id: string, label: string) => void;
  onCancel: () => void;
  /** Devuelve el mensaje del servidor si el precio se rechazó por absurdo (ADR-037). */
  onSave: (id: string, priceCop: number) => Promise<string | undefined>;
}) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Product[] | null>(null);
  const [price, setPrice] = useState(selection?.priceCop?.toString() ?? '');
  const [problem, setProblem] = useState('');
  const [rejection, setRejection] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const focusPrice = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [searching, setSearching] = useState(false);
  const lookup = useRef(false);

  const search = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (lookup.current) return;
    const text = query.trim();
    if (text.length < MIN_LETTERS) return;
    lookup.current = true;
    setSearching(true);
    setError(null);
    setMatches(null);
    try {
      const { items } = await call(
        api.GET('/products', { params: { query: catalogFilter(text) } }),
      );
      setMatches(items);
    } catch (failure: unknown) {
      setError(failure);
    } finally {
      lookup.current = false;
      setSearching(false);
    }
  };

  // Mientras se escribe, las presentaciones aparecen solas después de una pausa corta; el botón y Enter
  // siguen buscando al instante. Una respuesta tardía no reemplaza la de lo último que se escribió.
  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_LETTERS) return;
    let current = true;
    const timer = window.setTimeout(() => {
      call(api.GET('/products', { params: { query: catalogFilter(text) } }))
        .then(({ items }) => {
          if (!current) return;
          setError(null);
          setMatches(items);
        })
        // Sin red o con un error, simplemente no hay sugerencias: el botón sigue disponible.
        .catch(() => undefined);
    }, PAUSE_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  // El precio rechazado deja el editor abierto: el foco vuelve al campo, ya habilitado, para corregirlo.
  useEffect(() => {
    if (!focusPrice.current || disabled) return;
    focusPrice.current = false;
    form.current?.querySelector('input')?.focus();
  }, [rejection, disabled]);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!selection || disabled) return;
    const priceCop = Number(price.trim());
    if (!/^\d+$/.test(price.trim()) || priceCop < 100 || priceCop > 5_000_000) {
      setProblem('Escribe un precio entero entre $100 y $5.000.000, sin puntos.');
      return;
    }
    setProblem('');
    setRejection('');
    void onSave(selection.presentationId, priceCop).then((message) => {
      if (!message) return;
      focusPrice.current = true;
      setRejection(message);
    });
  };

  if (selection) {
    return (
      <form className="merchant-price-form" onSubmit={submit} ref={form}>
        <p>{selection.label}</p>
        <Field
          label="Precio oficial en pesos"
          autoFocus
          inputMode="numeric"
          value={price}
          onValue={(value) => {
            setPrice(value);
            setProblem('');
            setRejection('');
          }}
          disabled={disabled}
          error={problem || rejection || undefined}
        />
        <div className="actions">
          <button type="submit" className="btn" disabled={disabled}>
            {selection.priceCop === undefined ? 'Publicar precio' : 'Guardar precio'}
          </button>
          <button type="button" className="btn ghost" disabled={disabled} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }
  return (
    <>
      <form
        className="merchant-price-search"
        onSubmit={(event) => {
          void search(event);
        }}
      >
        <Field
          label="Buscar producto o código de barras"
          type="search"
          value={query}
          onValue={(value) => {
            setQuery(value);
            if (value.trim().length < MIN_LETTERS) setMatches(null);
          }}
          minLength={2}
          maxLength={120}
          disabled={disabled}
        />
        <button type="submit" className="btn ghost" disabled={disabled || searching}>
          {searching ? 'Buscando…' : 'Buscar en el catálogo'}
        </button>
      </form>
      <ResultsStatus
        count={
          matches ? matches.reduce((sum, { presentations }) => sum + presentations.length, 0) : null
        }
      />
      {error !== null && <ErrorState error={error} />}
      {matches &&
        (matches.some(({ presentations }) => presentations.length > 0) ? (
          <ul className="merchant-price-list">
            {matches.flatMap(({ name, brand, presentations }) =>
              presentations.map((presentation) => {
                const label = `${[name, brand].filter(Boolean).join(' ')} · ${formatPresentation(presentation)}`;
                return (
                  <li key={presentation.id}>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={disabled}
                      onClick={() => {
                        onChoose(presentation.id, label);
                      }}
                    >
                      {label}
                    </button>
                  </li>
                );
              }),
            )}
          </ul>
        ) : (
          <p className="muted">No encontramos presentaciones para esa búsqueda.</p>
        ))}
    </>
  );
}
