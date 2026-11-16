import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { useSession } from './session';

// Las fechas se leen en la hora de Colombia, sin importar la zona del teléfono.
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' });

export function Profile() {
  const { session, signOut } = useSession();
  const [error, setError] = useState<unknown>(null);
  if (session.status === 'loading') return <Loading />;
  if (session.status === 'active') {
    return (
      <>
        {session.suspendedUntil && (
          <p role="alert" className="banner warn">
            Tu cuenta está suspendida hasta el {DAY.format(new Date(session.suspendedUntil))}.
            Mientras tanto puedes ver el estado de tus aportes y apelar.
          </p>
        )}
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
