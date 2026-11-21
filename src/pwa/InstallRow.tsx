import { useId, useState } from 'react';
import { Link } from 'react-router';
import { InstallGuide } from './InstallGuide';
import { useInstall } from './useInstall';
import './install.css';

// Fila de «Yo»: la instalación siempre queda a mano, aunque el aviso de instalar se haya cerrado.
export function InstallRow() {
  return (
    <>
      <InstallOrGuide />
      <UninstallLink />
    </>
  );
}

// Los pasos para quitar la app viven en su propia pantalla, enlazada también desde Ajustes.
export function UninstallLink() {
  const { installed } = useInstall();
  return (
    <li>
      <Link to="/yo/app" className="nav-row">
        <span className="settings-text">
          <strong>Desinstalar la app</strong>
          <span className="muted">
            {installed
              ? 'Estás usando la app instalada: mira cómo quitarla'
              : 'Pasos para quitarla del celular o del computador'}
          </span>
        </span>
        <span className="nav-arrow" aria-hidden="true">
          ›
        </span>
      </Link>
    </li>
  );
}

function InstallOrGuide() {
  const { installed, canPrompt, platform, install } = useInstall();
  const [open, setOpen] = useState(false);
  const guideId = useId();
  if (installed) {
    return (
      <li className="install-row">
        <span className="settings-text">
          <strong>Instalar la app</strong>
          <span className="muted">Valora ya está instalada en este dispositivo.</span>
        </span>
      </li>
    );
  }
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
    </li>
  );
}
