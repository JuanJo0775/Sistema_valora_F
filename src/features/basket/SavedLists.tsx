import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Overlay } from '../../shared/ui/Overlay';
import { shortDay } from '../plan/planDates';
import { hasPrices, listSummary } from '../plan/savedListView';
import {
  deletePlan,
  duplicatePlan,
  MAX_PLANS,
  planName,
  renamePlan,
  type SavedPlan,
} from '../plan/savedPlan';
import { panelId } from './BasketTabs';
import { usePlans } from '../plan/usePlans';

export type UseMode = 'replace' | 'add';

const FULL = `Ya tienes ${String(MAX_PLANS)} listas guardadas. Borra una para guardar otra.`;

// «Guardadas»: una tarjeta por lista, con lo que se puede hacer con ella.
export function SavedLists({
  basketCount,
  onUse,
  onGoToList,
}: {
  // Cuántos productos hay hoy en «Mi lista»: si no hay ninguno, usar una lista no pregunta nada.
  basketCount: number;
  onUse: (plan: SavedPlan, mode: UseMode) => void;
  onGoToList: () => void;
}) {
  const plans = usePlans();
  const [message, setMessage] = useState('');
  const duplicate = (id: string) => {
    const { outcome } = duplicatePlan(id);
    setMessage(
      {
        saved: 'Lista duplicada.',
        full: FULL,
        failed: 'No se pudo guardar en este navegador (modo privado o sin espacio).',
        missing: 'Esa lista ya no está.',
      }[outcome],
    );
  };
  if (plans.length === 0) {
    return (
      <>
        <p role="status" className="saved-message muted">
          {message}
        </p>
        <EmptyState
          title="Aún no tienes listas guardadas"
          text="Arma tu lista y guárdala desde «Dónde comprar» para volver a usarla cuando quieras."
          action={
            <button type="button" className="btn ghost" onClick={onGoToList}>
              Ir a Mi lista
            </button>
          }
        />
      </>
    );
  }
  // De la más reciente a la más antigua.
  const ordered = [...plans].sort((a, b) =>
    a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0,
  );
  return (
    <>
      <p role="status" className="saved-message muted">
        {message}
      </p>
      <ul className="saved-lists">
        {ordered.map((plan) => (
          <SavedListCard
            key={plan.id}
            plan={plan}
            ask={basketCount > 0}
            onUse={onUse}
            onDuplicate={duplicate}
            onDeleted={() => {
              setMessage('Lista borrada.');
              // La tarjeta ya no está: el foco pasa al panel, para no perderlo.
              document.getElementById(panelId('guardadas'))?.focus();
            }}
          />
        ))}
      </ul>
    </>
  );
}

type Mode = 'view' | 'rename' | 'delete';

function SavedListCard({
  plan,
  ask,
  onUse,
  onDuplicate,
  onDeleted,
}: {
  plan: SavedPlan;
  ask: boolean;
  onUse: (plan: SavedPlan, mode: UseMode) => void;
  onDuplicate: (id: string) => void;
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const useButton = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const was = useRef<Mode>('view');
  const titleId = useId();
  const name = planName(plan);

  // El foco acompaña a la edición en el mismo lugar: al campo al renombrar, a «Cancelar» al pedir
  // confirmar el borrado, y de vuelta a «Renombrar» al terminar.
  useEffect(() => {
    if (mode === 'rename') input.current?.focus();
    else if (mode === 'delete') cancel.current?.focus();
    else if (was.current === 'rename') renameButton.current?.focus();
    was.current = mode;
  }, [mode]);

  const use = (how: UseMode) => {
    setAsking(false);
    onUse(plan, how);
  };
  const back = () => {
    setMode('view');
  };

  return (
    <li className="saved-list" aria-labelledby={titleId}>
      {mode === 'rename' ? (
        <form
          className="saved-rename"
          onSubmit={(event) => {
            event.preventDefault();
            renamePlan(plan.id, draft);
            back();
          }}
        >
          <label className="field">
            Nombre de la lista
            <input
              ref={input}
              value={draft}
              maxLength={60}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') back();
              }}
            />
          </label>
          <div className="saved-actions">
            <button type="submit" className="btn">
              Guardar nombre
            </button>
            <button type="button" className="btn ghost" onClick={back}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="saved-list-head">
          <h3 id={titleId}>{name}</h3>
          <p className="muted">{`Guardada el ${shortDay(plan.savedAt) ?? 'día de hoy'}`}</p>
          <p className={hasPrices(plan) ? undefined : 'muted'}>{listSummary(plan)}</p>
        </div>
      )}
      {mode === 'delete' && (
        <div className="saved-confirm" role="group" aria-label={`Borrar ${name}`}>
          <p>{`¿Borrar «${name}»? No se puede deshacer.`}</p>
          <div className="saved-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                deletePlan(plan.id);
                onDeleted();
              }}
            >
              Sí, borrar
            </button>
            <button ref={cancel} type="button" className="btn ghost" onClick={back}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {mode === 'view' && (
        <div className="saved-actions">
          <button
            ref={useButton}
            type="button"
            className="btn"
            aria-label={`Usar esta lista: ${name}`}
            aria-haspopup={ask ? 'dialog' : undefined}
            onClick={() => {
              if (ask) setAsking(true);
              else use('replace');
            }}
          >
            Usar esta lista
          </button>
          <Link to={`/canasta/plan/${plan.id}`} className="btn ghost" aria-label={`Abrir ${name}`}>
            Abrir
          </Link>
          <button
            ref={renameButton}
            type="button"
            className="btn ghost"
            aria-label={`Renombrar ${name}`}
            onClick={() => {
              setDraft(name);
              setMode('rename');
            }}
          >
            Renombrar
          </button>
          <button
            type="button"
            className="btn ghost"
            aria-label={`Duplicar ${name}`}
            onClick={() => {
              onDuplicate(plan.id);
            }}
          >
            Duplicar
          </button>
          <button
            type="button"
            className="btn ghost"
            aria-label={`Borrar ${name}`}
            onClick={() => {
              setMode('delete');
            }}
          >
            Borrar
          </button>
        </div>
      )}
      {asking && (
        <Overlay
          anchor={useButton}
          title={`Usar «${name}»`}
          onClose={() => {
            setAsking(false);
          }}
        >
          <div className="saved-ask">
            <p>Ya tienes productos en tu lista. ¿Qué hacemos con ellos?</p>
            <button
              type="button"
              className="btn"
              data-autofocus
              onClick={() => {
                use('replace');
              }}
            >
              Reemplazar mi lista
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                use('add');
              }}
            >
              Agregar a mi lista
            </button>
          </div>
        </Overlay>
      )}
    </li>
  );
}
