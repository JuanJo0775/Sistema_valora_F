import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import { ErrorState } from '../../shared/ui/ErrorState';

type Action = 'leave' | 'delete';

// H36, ADR-040: «Mi tienda» › dejar de administrarla o, si la cuenta la creó, eliminarla. El servidor
// decide qué se retira; aquí solo se pide la confirmación antes de llamar y se explica el efecto.
export function MerchantLeaveStore({
  storeName,
  canDelete,
  onFinished,
}: {
  storeName: string;
  canDelete: boolean;
  onFinished: () => void;
}) {
  const [asking, setAsking] = useState<Action | null>(null);
  const [done, setDone] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const leaveButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  const returnTo = useRef<Action | null>(null);
  useEffect(() => {
    if (asking) dialog.current?.focus();
    else if (returnTo.current) {
      (returnTo.current === 'delete' ? deleteButton : leaveButton).current?.focus();
      returnTo.current = null;
    }
  }, [asking]);
  useEffect(() => {
    if (done) title.current?.focus();
  }, [done]);

  async function confirm(action: Action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action === 'leave') await call(api.POST('/commerce/me/leave'));
      else await call(api.DELETE('/commerce/establishment'));
      setAsking(null);
      setDone(action);
    } catch (failure: unknown) {
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function cancel() {
    returnTo.current = asking;
    setAsking(null);
    setError(null);
  }

  if (done) {
    return (
      <section className="state" aria-labelledby="leave-done">
        <h3 id="leave-done" ref={title} tabIndex={-1}>
          {done === 'leave' ? `Dejaste de administrar ${storeName}` : `Eliminaste ${storeName}`}
        </h3>
        <p>
          {done === 'leave'
            ? 'Tus precios oficiales y promociones se retiraron. La tienda sigue en el mapa como tienda de la comunidad, sin dueño, y tu cuenta vuelve a ser de reportante.'
            : 'La tienda dejó de salir en el mapa y en las búsquedas, y tu cuenta vuelve a ser de reportante.'}
        </p>
        <Link className="btn" to="/yo" onClick={onFinished}>
          Ir a Yo
        </Link>
      </section>
    );
  }

  return (
    <section className="merchant-leave stack" aria-labelledby="leave-title">
      <h3 id="leave-title">Dejar la tienda</h3>
      {asking === null && (
        <>
          <button
            ref={leaveButton}
            className="btn ghost"
            type="button"
            onClick={() => {
              setAsking('leave');
            }}
          >
            Dejar de administrar esta tienda
          </button>
          {canDelete && (
            <button
              ref={deleteButton}
              className="btn ghost"
              type="button"
              onClick={() => {
                setAsking('delete');
              }}
            >
              Eliminar mi tienda
            </button>
          )}
        </>
      )}
      {asking && (
        <div
          ref={dialog}
          role="alertdialog"
          aria-labelledby="leave-question"
          aria-describedby="leave-effect"
          tabIndex={-1}
          className="banner warn"
        >
          <p id="leave-question">
            <strong>
              {asking === 'leave'
                ? `¿Dejar de administrar ${storeName}?`
                : `¿Eliminar ${storeName}?`}
            </strong>
          </p>
          <p id="leave-effect">
            Se retiran tus precios oficiales y tus promociones, y se cierran los casos abiertos de
            la tienda.{' '}
            {asking === 'leave'
              ? 'La tienda seguirá en el mapa como tienda de la comunidad, sin dueño. Tu cuenta vuelve a ser de reportante y puedes reclamarla de nuevo.'
              : 'La tienda deja de salir en el mapa y en las búsquedas, y ya no admite reportes ni reclamos. Esta acción no se puede deshacer desde la app.'}
          </p>
          {error !== null && <ErrorState error={error} />}
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => {
              void confirm(asking);
            }}
          >
            {asking === 'leave' ? 'Sí, dejar la tienda' : 'Sí, eliminar la tienda'}
          </button>
          <button className="btn ghost" type="button" disabled={busy} onClick={cancel}>
            Cancelar
          </button>
        </div>
      )}
    </section>
  );
}
