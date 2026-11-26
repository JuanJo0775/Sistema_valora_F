import { useId } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import { dayInColombia } from '../../shared/days';
import { DecisionForm } from './DecisionForm';
import { PendingList } from './PendingList';
import { explainWith } from './explain';

const load = () => call(api.GET('/moderation/merchant-cases')).then(({ items }) => items);
type Decision = 'revocar' | 'descartar' | 'aprobar' | 'rechazar';
const OPTIONS: { value: Decision; label: string }[] = [
  { value: 'revocar', label: 'Revocar comercio' },
  { value: 'descartar', label: 'Descartar caso' },
];
// Un reclamo (ADR-038) se aprueba o se rechaza; revocar y descartar son de denuncias y disputas.
const CLAIM_OPTIONS: { value: Decision; label: string }[] = [
  { value: 'aprobar', label: 'Aprobar reclamo' },
  { value: 'rechazar', label: 'Rechazar reclamo' },
];
const explain = explainWith({
  404: 'El caso ya no está pendiente.',
  DECISION_NOT_APPLICABLE:
    'Esa decisión no corresponde a este tipo de caso. Actualiza la lista e inténtalo de nuevo.',
});
const KIND_TITLE = { disputa: 'Disputa de propiedad', denuncia: 'Denuncia' };

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`;

// H18: un número, nunca quién denunció (EC-08). Una sola denuncia no es un patrón.
const reports = (count: number, accounts: number | undefined) =>
  `${plural(count, 'denuncia abierta', 'denuncias abiertas')}${
    accounts === undefined ? '' : ` de ${plural(accounts, 'cuenta distinta', 'cuentas distintas')}`
  }.`;

function Party({
  title,
  name,
  nit,
  phone,
  status,
  since,
}: {
  title: string;
  name: string;
  nit: string | null;
  phone: string;
  status?: string;
  since?: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      <dl>
        <dt>Responsable</dt>
        <dd>{name}</dd>
        <dt>NIT</dt>
        <dd>{nit ?? 'Sin NIT'}</dd>
        <dt>Teléfono</dt>
        <dd>{phone}</dd>
        {status && (
          <>
            <dt>Estado</dt>
            <dd>{status}</dd>
          </>
        )}
        {since && (
          <>
            <dt>Desde</dt>
            <dd>{dayInColombia(since)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

export function MerchantCases() {
  return (
    <PendingList
      load={load}
      empty="No hay casos de comercios pendientes"
      renderItem={(item, done) => (
        <>
          <h2>
            <Link to={`/tiendas/${item.establishment.id}`}>{item.establishment.name}</Link>
          </h2>
          <p className="muted">
            {item.kind === 'reclamo' ? 'Reclamo de tienda' : KIND_TITLE[item.kind]} ·{' '}
            {dayInColombia(item.createdAt)}
          </p>
          <p>{item.reason}</p>
          {item.owner ? (
            <Party
              title={item.kind === 'disputa' ? 'Dueño actual' : 'Responsable'}
              name={item.owner.responsibleName}
              nit={item.owner.nit}
              phone={item.owner.phone}
              status={item.owner.status === 'verificado' ? 'Verificado' : 'Preaprobado'}
            />
          ) : (
            <p className="muted">El comercio ya no está registrado.</p>
          )}
          {item.kind === 'disputa' &&
            (item.challenger ? (
              <Party
                title="Quien disputa"
                name={item.challenger.responsibleName}
                nit={item.challenger.nit ?? null}
                phone={item.challenger.phone}
                since={item.challenger.requestedAt}
              />
            ) : (
              <p className="muted">
                No hay datos de quien disputa: la disputa es anterior a que se guardaran.
              </p>
            ))}
          {item.kind === 'denuncia' && item.reportCount !== undefined && (
            <p>
              {reports(item.reportCount, item.distinctReporters)}
              {item.firstReportedAt && ` Desde el ${dayInColombia(item.firstReportedAt)}.`}
            </p>
          )}
          <p className="muted">
            {item.kind === 'reclamo'
              ? 'Aprobar deja la tienda verificada a nombre de quien reclama; rechazar cierra la solicitud.'
              : 'Revocar retira los precios oficiales y las promociones del comercio.'}
          </p>
          <DecisionForm
            id={item.id}
            options={item.kind === 'reclamo' ? CLAIM_OPTIONS : OPTIONS}
            explain={explain}
            onDecide={(decision, note) =>
              call(
                api.POST('/moderation/merchant-cases/{caseId}/decision', {
                  params: { path: { caseId: item.id } },
                  body: { decision, note },
                }),
              ).then(() => {
                done(item.establishment.name);
              })
            }
          />
        </>
      )}
    />
  );
}
