import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { type Role, useSession } from './session';
import { isUsabilityMode, setUsabilityMode } from '../../shared/usabilityMode';
import { RecentReports } from '../contributions/RecentReports';
import { SettingSwitch } from './SettingSwitch';
import { SuspendedNotice } from './SuspendedNotice';
import { ThemeChoice } from './ThemeChoice';
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
  const [testing, setTesting] = useState(isUsabilityMode);
  if (session.status === 'loading') return <Loading />;
  if (session.status === 'unknown') return <ErrorState error={session.error} onRetry={reload} />;
  if (session.status === 'active') {
    const section = SECTION_OF[session.role];
    return (
      <section className="profile">
        <header className="profile-head">
          <span className="profile-avatar" aria-hidden="true">
            {(session.displayName?.trim().charAt(0) || 'V').toUpperCase()}
          </span>
          <div className="profile-who">
            <h1>{session.displayName ? `Hola, ${session.displayName}` : 'Hola'}</h1>
            <p className="pill mute">{ROLE_LABEL[session.role]}</p>
          </div>
        </header>
        {session.suspendedUntil && <SuspendedNotice until={session.suspendedUntil} />}
        {error !== null && <ErrorState error={error} />}
        {(session.role === 'reportante' || section) && (
          <section className="profile-block" aria-labelledby="actividad">
            <h2 id="actividad" className="eyebrow">
              Tu actividad
            </h2>
            {session.role === 'reportante' && <RecentReports />}
            {section && session.role !== 'reportante' && (
              <Link to={section.to} className="btn">
                {section.label}
              </Link>
            )}
          </section>
        )}
        <section className="settings profile-block" aria-labelledby="ajustes">
          <h2 id="ajustes" className="eyebrow">
            Ajustes
          </h2>
          <ul className="settings-list profile-card">
            <li>
              <ThemeChoice />
            </li>
            {/* #28: solo para la prueba de usabilidad; se quita al cerrar la #28. */}
            <SettingSwitch
              title="Modo prueba de usabilidad"
              description="Muestra el cronómetro al registrar (EC-01)"
              on={testing}
              onChange={(on) => {
                setUsabilityMode(on);
                setTesting(on);
              }}
            />
            <li>
              <span className="settings-text">
                <strong>Privacidad</strong>
                <span className="muted">Tu nombre y tu ubicación nunca se publican</span>
                <Link to="/privacidad" className="settings-link">
                  Política de datos y cookies
                </Link>
              </span>
            </li>
          </ul>
        </section>
        <section className="profile-block" aria-labelledby="cuenta">
          <h2 id="cuenta" className="eyebrow">
            Cuenta
          </h2>
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
      </section>
    );
  }
  return (
    <EmptyState
      title="Tu cuenta"
      text="Con una cuenta puedes registrar precios y ver tus aportes. Para comparar no la necesitas."
      action={
        <div className="actions profile-guest">
          <Link to="/entrar" className="btn">
            Iniciar sesión
          </Link>
          <Link to="/crear-cuenta" className="btn ghost">
            Crear cuenta
          </Link>
          <ThemeChoice />
        </div>
      }
    />
  );
}
