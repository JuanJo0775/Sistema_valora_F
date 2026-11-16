import { useEffect, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import type { operations } from '../../shared/api/schema';
import { formatDistance } from '../../shared/location';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { MUNICIPALITIES } from '../comparison/criteria';
import { StoreMap } from '../stores/StoreMap';
import { STORE_TYPES } from '../stores/storeTypes';
import { DecisionForm } from './DecisionForm';
import './moderation.css';

type Proposal =
  operations['listStoreProposals']['responses'][200]['content']['application/json']['items'][number];

const MERGE = 'fusionar:';

const EXPLAINED: Partial<Record<string, string>> = {
  NOT_FOUND: 'Esta propuesta ya no está pendiente: otro moderador la decidió.',
  UNKNOWN_ESTABLISHMENT: 'Esa tienda ya no existe: elige otra decisión.',
};
const explain = (error: unknown) =>
  (error instanceof ApiError &&
    (EXPLAINED[error.code] ?? (error.status === 404 ? EXPLAINED.NOT_FOUND : undefined))) ||
  null;

// Fusionar solo con las tiendas parecidas que el servidor encontró cerca.
const options = ({ possibleDuplicates }: Proposal) => [
  { value: 'aprobar', label: 'Aprobar como tienda nueva' },
  ...possibleDuplicates.map(({ id, name }) => ({
    value: `${MERGE}${id}`,
    label: `Fusionar con ${name}`,
  })),
  { value: 'rechazar', label: 'Rechazar' },
];

// #57 (RF-010 y RF-013): las tiendas que sugieren las personas esperan aquí la decisión de un
// moderador. La ubicación es la de la tienda, nunca la de quien la sugirió (EC-08).
export function StoreProposals() {
  const [items, setItems] = useState<Proposal[] | null>(null);
  const [decided, setDecided] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    call(api.GET('/moderation/store-proposals'))
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

  const decide = (proposal: Proposal) => (choice: string, note: string) => {
    const merge = choice.startsWith(MERGE);
    const decision = merge ? 'fusionar' : (choice as 'aprobar' | 'rechazar');
    return call(
      api.POST('/moderation/store-proposals/{proposalId}/decision', {
        params: { path: { proposalId: proposal.id } },
        body: merge
          ? { decision, note, mergeInto: choice.slice(MERGE.length) }
          : { decision, note },
      }),
    ).then(() => {
      setItems((current) => (current ?? []).filter(({ id }) => id !== proposal.id));
      setDecided(`Decisión registrada: ${proposal.name}.`);
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
      {items?.length === 0 && <EmptyState title="No hay tiendas propuestas" />}
      <ul className="offers">
        {items?.map((proposal) => (
          <li key={proposal.id} className="offer">
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
            <DecisionForm
              id={proposal.id}
              options={options(proposal)}
              onDecide={decide(proposal)}
              explain={explain}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
