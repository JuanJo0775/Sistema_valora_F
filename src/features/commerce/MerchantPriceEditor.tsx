import { type SyntheticEvent, useRef, useState } from 'react';
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
  onSave: (id: string, priceCop: number) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Product[] | null>(null);
  const [price, setPrice] = useState(selection?.priceCop?.toString() ?? '');
  const [problem, setProblem] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [searching, setSearching] = useState(false);
  const lookup = useRef(false);

  const search = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (lookup.current) return;
    const text = query.trim();
    if (text.length < 2) return;
    lookup.current = true;
    setSearching(true);
    setError(null);
    setMatches(null);
    try {
      const filter = BARCODE.test(text) ? { barcode: text } : { q: text };
      const { items } = await call(api.GET('/products', { params: { query: filter } }));
      setMatches(items);
    } catch (failure: unknown) {
      setError(failure);
    } finally {
      lookup.current = false;
      setSearching(false);
    }
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!selection || disabled) return;
    const priceCop = Number(price.trim());
    if (!/^\d+$/.test(price.trim()) || priceCop < 100 || priceCop > 5_000_000) {
      setProblem('Escribe un precio entero entre $100 y $5.000.000, sin puntos.');
      return;
    }
    setProblem('');
    void onSave(selection.presentationId, priceCop);
  };

  if (selection) {
    return (
      <form className="merchant-price-form" onSubmit={submit}>
        <p>{selection.label}</p>
        <Field
          label="Precio oficial en pesos"
          autoFocus
          inputMode="numeric"
          value={price}
          onValue={(value) => {
            setPrice(value);
            setProblem('');
          }}
          disabled={disabled}
          error={problem || undefined}
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
        className="merchant-price-form"
        onSubmit={(event) => {
          void search(event);
        }}
      >
        <Field
          label="Buscar producto o código de barras"
          type="search"
          value={query}
          onValue={setQuery}
          minLength={2}
          maxLength={120}
          disabled={disabled || searching}
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
