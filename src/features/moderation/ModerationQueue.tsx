import { useEffect, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { formatCop } from '../../shared/money';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { SelectField } from '../../shared/ui/SelectField';
import { DecisionForm } from './DecisionForm';
import './moderation.css';

type Item = components['schemas']['ModerationItem'];
export type Reason = Item['reason'];
type Decision = 'aprobar' | 'descartar' | 'observar_cuentas';

export const REASONS: Record<Reason, string> = {
  desviacion: 'Muy distinto a la mediana',
  rafaga: 'Muchos reportes seguidos',
  marcado: 'Marcado como dudoso',
  apelacion: 'Apelación',
  discrepancia_oficial: 'Distinto al precio oficial',
  verificacion_comercio: 'Verificación de comercio',
};

const REASON_OPTIONS: { value: Reason | ''; label: string }[] = [
  { value: '', label: 'Todos los motivos' },
  ...(Object.keys(REASONS) as Reason[]).map((value) => ({ value, label: REASONS[value] })),
];

const DECISIONS: { value: Decision; label: string }[] = [
  { value: 'aprobar', label: 'Aprobar' },
  { value: 'descartar', label: 'Descartar' },
  { value: 'observar_cuentas', label: 'Observar cuentas' },
];

// #73 y #71 del backend: nadie decide su propio reporte ni la apelación de lo que descartó.
const OTHER_MODERATOR: Partial<Record<string, string>> = {
  OWN_REPORT: 'Es tu propio reporte: lo decide otro moderador.',
  SAME_MODERATOR: 'Tú descartaste este reporte: su apelación la decide otro moderador.',
};
const explain = (error: unknown) =>
  (error instanceof ApiError && OTHER_MODERATOR[error.code]) || null;

// «−73 %»: con el signo menos tipográfico, como se lee.
const deviation = (percent: number) =>
  `${percent < 0 ? '−' : '+'}${String(Math.abs(Math.round(percent)))} %`;

function comparison(item: Item) {
  const median =
    item.medianPriceCop === undefined
      ? false
      : `mediana ${formatCop(item.medianPriceCop)}${
          item.deviationPercent === undefined ? '' : ` (${deviation(item.deviationPercent)})`
        }`;
  return [
    `Reportado ${formatCop(item.reportedPriceCop)}`,
    median,
    item.officialPriceCop !== undefined && `oficial ${formatCop(item.officialPriceCop)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// RF-012 y RF-013: la cola de precios en revisión. Nunca dice quién reportó ni quién marcó (EC-08).
export function ModerationQueue() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [decided, setDecided] = useState('');
  const [reason, setReason] = useState<Reason | ''>('');
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    call(api.GET('/moderation/queue', { params: { query: reason ? { reason } : {} } }))
      .then(({ items: pending }) => {
        if (current) setItems(pending ?? []);
      })
      .catch((failure: unknown) => {
        if (current) setError(failure);
      });
    return () => {
      current = false;
    };
  }, [reason, attempt]);

  const decide = (item: Item) => (decision: Decision, note: string) =>
    call(
      api.POST('/moderation/{itemId}/decision', {
        params: { path: { itemId: item.id } },
        body: { decision, note },
      }),
    ).then(() => {
      setItems((current) => (current ?? []).filter(({ id }) => id !== item.id));
      setDecided(`Decisión registrada: ${item.productName}.`);
    });

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
      <SelectField
        label="Motivo"
        value={reason}
        options={REASON_OPTIONS}
        onChange={(chosen) => {
          setItems(null);
          setReason(chosen);
        }}
      />
      {decided && (
        <p role="status" className="muted">
          {decided}
        </p>
      )}
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState title="No hay precios en revisión" />}
      <ul className="offers">
        {items?.map((item) => (
          <li key={item.id} className="offer">
            <p className="badges">
              <span className="pill warn">{REASONS[item.reason]}</span>
            </p>
            <h2>{item.productName}</h2>
            <p className="muted">{item.establishmentName}</p>
            <p>{comparison(item)}</p>
            {item.reportersCount > 0 && (
              <p className="muted">
                {`Marcado como dudoso por ${String(item.reportersCount)} ${item.reportersCount === 1 ? 'cuenta' : 'cuentas'}`}
              </p>
            )}
            {item.appealNote && (
              <blockquote className="appeal-note">{`«${item.appealNote}»`}</blockquote>
            )}
            <DecisionForm
              id={item.id}
              options={DECISIONS}
              onDecide={decide(item)}
              explain={explain}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
