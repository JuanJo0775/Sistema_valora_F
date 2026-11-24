import { type ReactNode, useEffect, useRef, useState } from 'react';
import { restoreFocus } from '../../shared/focus';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SkeletonList } from '../../shared/ui/Skeleton';
import './moderation.css';

type Outcome<T> = { key: string; items: T[] } | { key: string; error: unknown };

// Una lista de casos pendientes de moderación: carga, reintento, vacío y cada caso decidido sale
// de la lista. `source` cambia cuando cambian los filtros y vuelve a cargar.
export function PendingList<T extends { id: string }>({
  source = '',
  load,
  empty,
  renderItem,
}: {
  source?: string;
  load: () => Promise<T[]>;
  empty: string;
  renderItem: (item: T, done: (label: string) => void) => ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome<T> | null>(null);
  const [decided, setDecided] = useState('');
  // La tarjeta decidida desaparece de la lista: el foco pasa al aviso del resultado.
  const decidedRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (decided) restoreFocus(decidedRef.current);
  }, [decided]);
  // La última función de carga, sin volver a cargar cada vez que cambia.
  const latest = useRef(load);
  const key = `${String(attempt)}|${source}`;

  useEffect(() => {
    latest.current = load;
  }, [load]);

  useEffect(() => {
    let current = true;
    latest
      .current()
      .then((items) => {
        if (current) setOutcome({ key, items });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    return () => {
      current = false;
    };
  }, [key]);

  const result = outcome?.key === key ? outcome : null;
  if (result && 'error' in result) {
    return (
      <ErrorState
        error={result.error}
        onRetry={() => {
          setAttempt((count) => count + 1);
        }}
      />
    );
  }
  const done = (id: string) => (label: string) => {
    setOutcome((current) =>
      current && 'items' in current
        ? { ...current, items: current.items.filter((item) => item.id !== id) }
        : current,
    );
    setDecided(`Decisión registrada: ${label}.`);
  };
  return (
    <>
      {decided && (
        <p role="status" ref={decidedRef} tabIndex={-1} className="muted">
          {decided}
        </p>
      )}
      {!result && <SkeletonList kind="row" />}
      {result?.items.length === 0 && <EmptyState title={empty} />}
      <ul className="offers">
        {result?.items.map((item) => (
          <li key={item.id} className="offer">
            {renderItem(item, done(item.id))}
          </li>
        ))}
      </ul>
    </>
  );
}
