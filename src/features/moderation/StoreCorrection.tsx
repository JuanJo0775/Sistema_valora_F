import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { StoreMap } from '../stores/StoreMap';
import { ALREADY_DECIDED, CatalogDecision } from './CatalogDecision';
import { explainWith } from './explain';

type Correction = components['schemas']['StoreCorrectionQueueItem'];
const explain = explainWith({ 404: ALREADY_DECIDED });

export function StoreCorrection({
  correction,
  onDecided,
}: {
  correction: Correction;
  onDecided: (name: string) => void;
}) {
  const { id, establishmentId, current, proposed, possibleDuplicates } = correction;
  const point =
    proposed.lat !== undefined && proposed.lng !== undefined
      ? { lat: proposed.lat, lng: proposed.lng }
      : null;

  return (
    <>
      <h2>Corrección de tienda</h2>
      <p>
        <Link to={`/tiendas/${establishmentId}`}>{current.name}</Link>
      </p>
      {proposed.name !== undefined && (
        <p>
          Nombre actual: {current.name} · Propuesto: {proposed.name}
        </p>
      )}
      {point && (
        <>
          <p>
            Ubicación actual: {current.lat.toFixed(5)}, {current.lng.toFixed(5)}
          </p>
          <p>
            Ubicación propuesta: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
          </p>
          <StoreMap stores={[]} label="Ubicación propuesta" picked={point} />
        </>
      )}
      {possibleDuplicates.length > 0 && (
        <p>Tiendas con nombre similar: {possibleDuplicates.map(({ name }) => name).join(', ')}.</p>
      )}
      <CatalogDecision
        id={id}
        approveLabel="Aprobar corrección"
        duplicates={[]}
        explain={explain}
        send={(body) =>
          call(
            api.POST('/moderation/store-proposals/{proposalId}/decision', {
              params: { path: { proposalId: id } },
              body,
            }),
          )
        }
        onDone={() => {
          onDecided(current.name);
        }}
      />
    </>
  );
}
