import { useId, useState } from 'react';
import { Link } from 'react-router';
import { InstallGuide } from './InstallGuide';
import { useInstall } from './useInstall';
import './install.css';

// Fila de «Yo»: la instalación siempre queda a mano, aunque el aviso de instalar se haya cerrado.
// Los pasos para quitar la app no se anuncian aquí: están en Ajustes › Opciones avanzadas.
export function InstallRow() {
  return <InstallOrGuide />;
}

function InstallOrGuide() {
  const { installed, canPrompt, platform, install } = useInstall();
  const [open, setOpen] = useState(false);
  const guideId = useId();
  // Ya instalada no hay nada que instalar: la fila se va en vez de quedar como un texto suelto sin flecha.
  if (installed) return null;
  return (
    <li className="install-row">
      <button
        type="button"
        className="nav-row"
        aria-expanded={canPrompt ? undefined : open}
        aria-controls={canPrompt ? undefined : guideId}
        onClick={() => {
          if (canPrompt) void install();
          else setOpen(!open);
        }}
      >
        <span className="settings-text">
          <strong>Instalar la app</strong>
          <span className="muted">
            {canPrompt
              ? 'Ábrela desde el ícono, como cualquier app'
              : 'Mira cómo añadirla a la pantalla de inicio'}
          </span>
        </span>
        <span className="nav-arrow" aria-hidden="true">
          ›
        </span>
      </button>
      {!canPrompt && open && <InstallGuide platform={platform} id={guideId} />}
      <Link to="/yo/app" className="settings-link install-more">
        Ver la guía completa
      </Link>
    </li>
  );
}
