import { useCallback, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { dayInColombia, relativeDay } from '../../shared/days';
import { formatCop } from '../../shared/money';
import { SelectField } from '../../shared/ui/SelectField';
import { explainWith } from './explain';
import { DecisionForm } from './DecisionForm';
import { PendingList } from './PendingList';

type Item = components['schemas']['ModerationItem'];
export type Reason = Item['reason'];
type Decision = 'aprobar' | 'descartar' | 'observar_cuentas';

export const REASONS: Record<Reason, string> = {
  desviacion: 'Muy distinto a la mediana',
  sin_referencia: 'Sin referencia para comparar',
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
const OTHER_MODERATOR = {
  OWN_REPORT: 'Es tu propio reporte: lo decide otro moderador.',
  SAME_MODERATOR: 'Tú descartaste este reporte: su apelación la decide otro moderador.',
};
const explain = explainWith(OTHER_MODERATOR);

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
  const [reason, setReason] = useState<Reason | ''>('');
  const load = useCallback(
    () =>
      call(api.GET('/moderation/queue', { params: { query: reason ? { reason } : {} } })).then(
        ({ items }) => items ?? [],
      ),
    [reason],
  );

  return (
    <>
      <SelectField label="Motivo" value={reason} options={REASON_OPTIONS} onChange={setReason} />
      <PendingList
        source={reason}
        load={load}
        empty="No hay precios en revisión"
        renderItem={(item: Item, done) => (
          <>
            <p className="badges">
              <span className="pill warn">{REASONS[item.reason]}</span>
            </p>
            <h2>{item.productName}</h2>
            <p className="muted">{item.establishmentName}</p>
            <p>{comparison(item)}</p>
            {item.reason === 'sin_referencia' && (
              <p>Precio oficial de un comercio sin otras tiendas para compararlo</p>
            )}
            <p className="muted">{`Reportado el ${dayInColombia(item.createdAt)} (${relativeDay(item.createdAt).toLowerCase()})`}</p>
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
              options={
                item.reason === 'sin_referencia'
                  ? DECISIONS.filter(({ value }) => value !== 'observar_cuentas')
                  : DECISIONS
              }
              onDecide={(decision: Decision, note) =>
                call(
                  api.POST('/moderation/{itemId}/decision', {
                    params: { path: { itemId: item.id } },
                    body: { decision, note },
                  }),
                ).then(() => {
                  done(item.productName);
                })
              }
              explain={explain}
            />
          </>
        )}
      />
    </>
  );
}
