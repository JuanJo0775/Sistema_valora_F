import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import { dayInColombia } from '../../shared/days';
import { DecisionForm } from './DecisionForm';
import { PendingList } from './PendingList';
import { explainWith } from './explain';

const load = () => call(api.GET('/moderation/merchant-cases')).then(({ items }) => items);
const OPTIONS = [
  { value: 'revocar' as const, label: 'Revocar comercio' },
  { value: 'descartar' as const, label: 'Descartar caso' },
];
const explain = explainWith({ 404: 'El caso ya no está pendiente.' });

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
            {item.kind === 'disputa' ? 'Disputa de propiedad' : 'Denuncia'} ·{' '}
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
            Revocar retira los precios oficiales y las promociones del comercio.
          </p>
          <DecisionForm
            id={item.id}
            options={OPTIONS}
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
