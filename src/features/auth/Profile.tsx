import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { useSession } from './session';
import { SuspendedNotice } from './SuspendedNotice';

export function Profile() {
  const { session, signOut, reload } = useSession();
  const [error, setError] = useState<unknown>(null);
  if (session.status === 'loading') return <Loading />;
  if (session.status === 'unknown') return <ErrorState error={session.error} onRetry={reload} />;
  if (session.status === 'active') {
    return (
      <>
        {session.suspendedUntil && <SuspendedNotice until={session.suspendedUntil} />}
        {error !== null && <ErrorState error={error} />}
        <EmptyState
          title="Tu cuenta"
          text={`Entraste como ${session.role}.`}
          action={
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setError(null);
                signOut().catch((failure: unknown) => {
                  setError(failure);
                });
              }}
            >
              Cerrar sesión
            </button>
          }
        />
      </>
    );
  }
  return (
    <EmptyState
      title="Tu cuenta"
      text="Con una cuenta puedes registrar precios y ver tus aportes. Para comparar no la necesitas."
      action={
        <div className="actions">
          <Link to="/entrar" className="btn">
            Iniciar sesión
          </Link>
          <Link to="/crear-cuenta" className="btn ghost">
            Crear cuenta
          </Link>
        </div>
      }
    />
  );
}
