import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { InstallRow } from '../../pwa/InstallRow';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { type Role, useSession } from './session';
import { SuspendedNotice } from './SuspendedNotice';
import { useAvisos } from '../avisos/avisosContext';
import { totalOf } from '../avisos/Campana';
import { AvisosPush } from '../avisos/push/AvisosPush';
import { usePlans } from '../plan/usePlans';
import './auth.css';

// La sección privada de cada rol.
const SECTION_OF: Partial<Record<Role, { to: string; label: string; text: string }>> = {
  reportante: {
    to: '/mis-aportes',
    label: 'Mis aportes',
    text: 'Los precios que registraste y su estado',
  },
  comercio: {
    to: '/comercios',
    label: 'Mi tienda',
    text: 'Administra tus precios oficiales y consulta tus avisos',
  },
  moderador: { to: '/moderacion', label: 'Moderación', text: 'Revisa los reportes pendientes' },
};

// Fila navegable de «Yo»: un enlace con flecha y una línea que dice a dónde lleva.
function NavRow({ to, label, text }: { to: string; label: string; text: string }) {
  return (
    <li>
      <Link to={to} className="nav-row">
        <span className="settings-text">
          <strong>{label}</strong>
          <span className="muted">{text}</span>
        </span>
        <span className="nav-arrow" aria-hidden="true">
          ›
        </span>
      </Link>
    </li>
  );
}

// Un grupo de filas con su encabezado.
function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="profile-block" aria-labelledby={id}>
      <h2 id={id} className="eyebrow">
        {title}
      </h2>
      <ul className="nav-list profile-card">{children}</ul>
    </section>
  );
}

const SETTINGS_ROW = (
  <>
    <NavRow to="/yo/ajustes" label="Ajustes" text="Tema, municipio, radio y pruebas" />
    <InstallRow />
  </>
);
const PRIVACY_ROW = (
  <NavRow
    to="/privacidad"
    label="Política de datos y cookies"
    text="Tu nombre y tu ubicación nunca se publican"
  />
);

// Lo que se guardó en este navegador no depende de la cuenta: el atajo sale con o sin sesión, y solo
// cuando hay listas (sin ellas no hay a dónde llevar).
function SavedListsGroup() {
  const saved = usePlans().length;
  if (saved === 0) return null;
  return (
    <Group id="listas" title="Mi canasta">
      <NavRow
        to="/canasta?tab=guardadas"
        label={`Mis listas guardadas (${String(saved)})`}
        text="Las que guardaste en este navegador"
      />
    </Group>
  );
}

const ROLE_LABEL: Record<Role, string> = {
  reportante: 'Reportante',
  moderador: 'Moderador',
  comercio: 'Comercio',
};

// ADR-043: lo que dice la fila de la sección del rol cuando hay algo esperando; sin nada, su texto de siempre.
function sectionText(role: Role, total: number | undefined, fallback: string): string {
  if (total === undefined || total === 0) return fallback;
  if (role === 'moderador')
    return `Tienes ${String(total)} ${total === 1 ? 'caso' : 'casos'} por revisar`;
  if (role === 'comercio')
    return `Tienes ${String(total)} ${total === 1 ? 'aviso nuevo' : 'avisos nuevos'}`;
  return fallback;
}

export function Profile() {
  const { session, signOut, reload } = useSession();
  const [error, setError] = useState<unknown>(null);
  const avisos = useAvisos();
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
        {session.suspendedUntil && (
          <SuspendedNotice until={session.suspendedUntil} reason={session.suspensionReason} />
        )}
        {error !== null && <ErrorState error={error} />}
        {section && (
          <Group id="actividad" title="Mi actividad">
            <NavRow
              to={section.to}
              label={section.label}
              text={sectionText(session.role, totalOf(avisos), section.text)}
            />
            {session.role === 'reportante' && !session.suspendedUntil && (
              <NavRow
                to="/comercios/registro"
                label="Registrar mi tienda"
                text="Vincula tu cuenta con tu tienda"
              />
            )}
          </Group>
        )}
        {(session.role === 'moderador' || session.role === 'comercio') && <AvisosPush />}
        <SavedListsGroup />
        <Group id="preferencias" title="Preferencias">
          {SETTINGS_ROW}
        </Group>
        <Group id="privacidad" title="Privacidad">
          {PRIVACY_ROW}
        </Group>
        <Group id="cuenta" title="Cuenta">
          <li>
            <button
              type="button"
              className="nav-row"
              onClick={() => {
                setError(null);
                signOut().catch((failure: unknown) => {
                  setError(failure);
                });
              }}
            >
              <span className="settings-text">
                <strong>Cerrar sesión</strong>
              </span>
            </button>
          </li>
        </Group>
      </section>
    );
  }
  return (
    <section className="profile">
      <EmptyState
        title="Tu cuenta"
        level={1}
        text="Con una cuenta puedes registrar precios y ver tus aportes. Para comparar no la necesitas."
        action={
          <div className="actions profile-guest">
            <Link to="/entrar" className="btn">
              Iniciar sesión
            </Link>
            <Link to="/crear-cuenta" className="btn ghost">
              Crear cuenta
            </Link>
          </div>
        }
      />
      <SavedListsGroup />
      <Group id="preferencias" title="Preferencias">
        {SETTINGS_ROW}
      </Group>
      <Group id="privacidad" title="Privacidad">
        {PRIVACY_ROW}
      </Group>
    </section>
  );
}
