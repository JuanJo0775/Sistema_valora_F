import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { type Role, useSession } from './session';
import { RecentReports } from '../contributions/RecentReports';
import { SuspendedNotice } from './SuspendedNotice';
import './auth.css';

// La sección privada de cada rol. La del comercio llega en el Corte 3.
const SECTION_OF: Partial<Record<Role, { to: string; label: string }>> = {
  reportante: { to: '/mis-aportes', label: 'Mis aportes' },
  moderador: { to: '/moderacion', label: 'Moderación' },
};

const ROLE_LABEL: Record<Role, string> = {
  reportante: 'Reportante',
  moderador: 'Moderador',
  comercio: 'Comercio',
};

export function Profile() {
  const { session, signOut, reload } = useSession();
  const [error, setError] = useState<unknown>(null);
  if (session.status === 'loading') return <Loading />;
  if (session.status === 'unknown') return <ErrorState error={session.error} onRetry={reload} />;
  if (session.status === 'active') {
    const section = SECTION_OF[session.role];
    return (
      <section className="profile">
        <div>
          <h1>Hola</h1>
          <p className="muted">{ROLE_LABEL[session.role]}</p>
        </div>
        {session.suspendedUntil && <SuspendedNotice until={session.suspendedUntil} />}
        {error !== null && <ErrorState error={error} />}
        {session.role === 'reportante' && <RecentReports />}
        {section && session.role !== 'reportante' && (
          <Link to={section.to} className="btn">
            {section.label}
          </Link>
        )}
        <section className="settings" aria-labelledby="ajustes">
          <h2 id="ajustes" className="eyebrow">
            Ajustes
          </h2>
          <ul className="settings-list">
            <li>
              <span className="settings-text">
                <strong>Privacidad</strong>
                <span className="muted">Tu nombre y tu ubicación nunca se publican</span>
              </span>
            </li>
          </ul>
        </section>
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
      </section>
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
