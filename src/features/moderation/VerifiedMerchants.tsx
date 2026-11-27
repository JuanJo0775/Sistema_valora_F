import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { dayInColombia } from '../../shared/days';
import { restoreFocus } from '../../shared/focus';
import { Loading } from '../../shared/ui/Loading';
import { DecisionForm } from './DecisionForm';
import { explainWith } from './explain';
import { Party } from './Party';

type Merchant = components['schemas']['VerifiedMerchant'];
type Outcome = { items: Merchant[]; total: number } | { error: true };

const REVOKE = [
  {
    value: 'revocar' as const,
    label: 'Revocar comercio',
    confirm:
      'Se retiran los precios oficiales y las promociones del comercio, y la cuenta vuelve a ser de reportante. ¿Confirmas?',
  },
];
const explain = explainWith({ 404: 'Este comercio ya no está verificado. Actualiza la lista.' });

// H14: moderación solo veía casos. Esta lista le deja revisar un comercio verificado y revocarlo por
// iniciativa propia. Nunca la cuenta del comercio (EC-08). Si falla, la cola de casos sigue sola.
export function VerifiedMerchants() {
  const title = useId();
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [decided, setDecided] = useState('');
  const decidedRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (decided) restoreFocus(decidedRef.current);
  }, [decided]);

  useEffect(() => {
    let current = true;
    call(api.GET('/moderation/merchants'))
      .then((result) => {
        if (current) setOutcome(result);
      })
      .catch(() => {
        if (current) setOutcome({ error: true });
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  const revoked = (id: string, name: string) => {
    setOutcome((now) =>
      now && 'items' in now
        ? {
            items: now.items.filter((item) => item.establishment.id !== id),
            total: Math.max(0, now.total - 1),
          }
        : now,
    );
    setDecided(`Decisión registrada: ${name}.`);
  };

  return (
    <section aria-labelledby={title} className="stack">
      <h2 id={title}>Comercios verificados</h2>
      {decided && (
        <p role="status" ref={decidedRef} tabIndex={-1} className="muted">
          {decided}
        </p>
      )}
      {!outcome && <Loading text="Consultando los comercios verificados…" />}
      {outcome && 'error' in outcome && (
        <div>
          <p>No pudimos cargar los comercios verificados.</p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setOutcome(null);
              setAttempt((count) => count + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {outcome && 'items' in outcome && (
        <>
          {outcome.items.length === 0 && <p className="muted">No hay comercios verificados</p>}
          {outcome.total > outcome.items.length && outcome.items.length > 0 && (
            <p className="muted">{`Se muestran los ${String(outcome.items.length)} más recientes de ${String(outcome.total)}.`}</p>
          )}
          <ul className="offers">
            {outcome.items.map((merchant) => (
              <li key={merchant.establishment.id} className="offer">
                <h3>
                  <Link to={`/tiendas/${merchant.establishment.id}`}>
                    {merchant.establishment.name}
                  </Link>
                </h3>
                {merchant.verifiedAt && (
                  <p className="muted">{`Verificado el ${dayInColombia(merchant.verifiedAt)}`}</p>
                )}
                <Party
                  title="Responsable"
                  name={merchant.responsibleName}
                  nit={merchant.nit}
                  phone={merchant.phone}
                />
                <DecisionForm
                  id={merchant.establishment.id}
                  options={REVOKE}
                  explain={explain}
                  onDecide={(_decision, note) =>
                    call(
                      api.POST('/moderation/merchants/{establishmentId}/revoke', {
                        params: { path: { establishmentId: merchant.establishment.id } },
                        body: { note },
                      }),
                    ).then(() => {
                      revoked(merchant.establishment.id, merchant.establishment.name);
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
