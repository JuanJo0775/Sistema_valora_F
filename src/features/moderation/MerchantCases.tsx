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
            <dl>
              <dt>Responsable</dt>
              <dd>{item.owner.responsibleName}</dd>
              <dt>NIT</dt>
              <dd>{item.owner.nit ?? 'Sin NIT'}</dd>
              <dt>Teléfono</dt>
              <dd>{item.owner.phone}</dd>
              <dt>Estado</dt>
              <dd>{item.owner.status === 'verificado' ? 'Verificado' : 'Preaprobado'}</dd>
            </dl>
          ) : (
            <p className="muted">El comercio ya no está registrado.</p>
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
