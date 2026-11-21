import { Link } from 'react-router';
import { useSession } from './session';
import './auth.css';

// Final de Ajustes: lo que casi nadie necesita, plegado y con texto neutro. Dentro, separadas,
// la guía para desinstalar la app y (solo con sesión) eliminar la cuenta.
export function AdvancedOptions() {
  const { session } = useSession();
  return (
    <details className="profile-block advanced">
      <summary className="advanced-summary">
        <span>Opciones avanzadas</span>
        <span className="nav-arrow advanced-arrow" aria-hidden="true">
          ›
        </span>
      </summary>
      <ul className="nav-list profile-card">
        <li>
          <Link to="/yo/app" className="nav-row">
            <span className="settings-text">
              <strong>Desinstalar la app</strong>
              <span className="muted">Pasos para quitarla del celular o del computador</span>
            </span>
            <span className="nav-arrow" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        {session.status === 'active' && (
          <li className="advanced-divider">
            <Link to="/yo/eliminar-cuenta" className="nav-row danger-row">
              <span className="settings-text">
                <strong>Eliminar mi cuenta</strong>
                <span className="muted">Tienes 10 días para arrepentirte; luego es definitivo</span>
              </span>
              <span className="nav-arrow" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        )}
      </ul>
    </details>
  );
}
