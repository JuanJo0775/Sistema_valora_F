import { api, call } from '../../shared/api';
import type { operations } from '../../shared/api/schema';
import { formatDistance } from '../../shared/location';
import { MUNICIPALITIES } from '../comparison/criteria';
import { StoreMap } from '../stores/StoreMap';
import { STORE_TYPES } from '../stores/storeTypes';
import { ALREADY_DECIDED, CatalogDecision } from './CatalogDecision';
import { explainWith } from './explain';
import { PendingList } from './PendingList';

type Proposal =
  operations['listStoreProposals']['responses'][200]['content']['application/json']['items'][number];

const explain = explainWith({
  404: ALREADY_DECIDED,
  UNKNOWN_ESTABLISHMENT: 'Esa tienda ya no existe: elige otra decisión.',
});

const load = () => call(api.GET('/moderation/store-proposals')).then(({ items }) => items);

// #57 (RF-010 y RF-013): las tiendas que sugieren las personas esperan aquí la decisión de un
// moderador. La ubicación es la de la tienda, nunca la de quien la sugirió (EC-08).
export function StoreProposals() {
  return (
    <PendingList
      load={load}
      empty="No hay tiendas propuestas"
      renderItem={(proposal: Proposal, done) => (
        <>
          {proposal.outOfZone && (
            <p className="badges">
              <span className="pill warn">Fuera del Quindío</span>
            </p>
          )}
          <h2>{proposal.name}</h2>
          <p className="muted">{`${STORE_TYPES[proposal.type]} · ${MUNICIPALITIES[proposal.municipality]}`}</p>
          {proposal.address && <p>{proposal.address}</p>}
          {proposal.possibleDuplicates.length > 0 && (
            <p>
              {`Posibles duplicados: ${proposal.possibleDuplicates
                .map(({ name, distanceM }) => `${name} (${formatDistance(distanceM)})`)
                .join(', ')}`}
            </p>
          )}
          <StoreMap stores={[]} label={`Ubicación de ${proposal.name}`} picked={proposal} />
          <CatalogDecision
            id={proposal.id}
            approveLabel="Aprobar como tienda nueva"
            duplicates={proposal.possibleDuplicates}
            send={(body) =>
              call(
                api.POST('/moderation/store-proposals/{proposalId}/decision', {
                  params: { path: { proposalId: proposal.id } },
                  body,
                }),
              )
            }
            onDone={() => {
              done(proposal.name);
            }}
            explain={explain}
          />
        </>
      )}
    />
  );
}
