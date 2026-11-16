import { useEffect, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { formatCop } from '../../shared/money';
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
  const [items, setItems] = useState<Item[]>([]);
  const [decided, setDecided] = useState('');

  useEffect(() => {
    void call(api.GET('/moderation/queue')).then(({ items: pending }) => {
      setItems(pending ?? []);
    });
  }, []);

  const decide = (item: Item) => (decision: Decision, note: string) =>
    call(
      api.POST('/moderation/{itemId}/decision', {
        params: { path: { itemId: item.id } },
        body: { decision, note },
      }),
    ).then(() => {
      setItems((current) => current.filter(({ id }) => id !== item.id));
      setDecided(`Decisión registrada: ${item.productName}.`);
    });

  return (
    <>
      {decided && (
        <p role="status" className="muted">
          {decided}
        </p>
      )}
      <ul className="offers">
        {items.map((item) => (
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
