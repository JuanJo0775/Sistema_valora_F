import { useEffect, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import type { operations } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { formatPresentation } from '../catalog/presentation';
import { DecisionForm } from './DecisionForm';
import './moderation.css';

type Request =
  operations['listProductRequests']['responses'][200]['content']['application/json']['items'][number];

const MERGE = 'fusionar:';

const EXPLAINED: Partial<Record<string, string>> = {
  NOT_FOUND: 'Esta propuesta ya no está pendiente: otro moderador la decidió.',
  BARCODE_TAKEN: 'Otro producto ya tiene ese código de barras: solo se puede rechazar.',
  UNKNOWN_PRODUCT: 'Ese producto ya no existe: elige otra decisión.',
  MIXED_UNIT_BASES:
    'La presentación no se mide igual que ese producto (peso, volumen o unidades): elige otra decisión.',
};
const explain = (error: unknown) =>
  (error instanceof ApiError &&
    (EXPLAINED[error.code] ?? (error.status === 404 ? EXPLAINED.NOT_FOUND : undefined))) ||
  null;

const options = ({ possibleDuplicates }: Request) => [
  { value: 'aprobar', label: 'Aprobar como producto nuevo' },
  ...possibleDuplicates.map(({ id, name }) => ({
    value: `${MERGE}${id}`,
    label: `Fusionar con ${name}`,
  })),
  { value: 'rechazar', label: 'Rechazar' },
];

// #57 (RF-011 y RF-013): los productos que piden las personas esperan aquí la decisión de un
// moderador. Nunca dice quién lo pidió (EC-08).
export function ProductRequests() {
  const [items, setItems] = useState<Request[] | null>(null);
  const [categories, setCategories] = useState<Partial<Record<string, string>>>({});
  const [decided, setDecided] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    // Sin la lista de categorías, cada propuesta muestra el código de la suya.
    call(api.GET('/categories'))
      .then(({ items: all }) => {
        if (current) setCategories(Object.fromEntries(all.map(({ code, name }) => [code, name])));
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    call(api.GET('/moderation/product-requests'))
      .then(({ items: pending }) => {
        if (current) setItems(pending);
      })
      .catch((failure: unknown) => {
        if (current) setError(failure);
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  const decide = (request: Request) => (choice: string, note: string) => {
    const merge = choice.startsWith(MERGE);
    const decision = merge ? 'fusionar' : (choice as 'aprobar' | 'rechazar');
    return call(
      api.POST('/moderation/product-requests/{requestId}/decision', {
        params: { path: { requestId: request.id } },
        body: merge
          ? { decision, note, mergeInto: choice.slice(MERGE.length) }
          : { decision, note },
      }),
    ).then(() => {
      setItems((current) => (current ?? []).filter(({ id }) => id !== request.id));
      setDecided(`Decisión registrada: ${request.name}.`);
    });
  };

  if (error !== null) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          setError(null);
          setItems(null);
          setAttempt((count) => count + 1);
        }}
      />
    );
  }
  return (
    <>
      {decided && (
        <p role="status" className="muted">
          {decided}
        </p>
      )}
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState title="No hay productos propuestos" />}
      <ul className="offers">
        {items?.map((request) => (
          <li key={request.id} className="offer">
            <h2>{request.name}</h2>
            <p className="muted">
              {[
                request.brand,
                formatPresentation(request),
                categories[request.categoryCode] ?? request.categoryCode,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {request.barcode && <p>{`Código de barras ${request.barcode}`}</p>}
            {request.possibleDuplicates.length > 0 && (
              <p>
                {`Posibles duplicados: ${request.possibleDuplicates.map(({ name }) => name).join(', ')}`}
              </p>
            )}
            <DecisionForm
              id={request.id}
              options={options(request)}
              onDecide={decide(request)}
              explain={explain}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
