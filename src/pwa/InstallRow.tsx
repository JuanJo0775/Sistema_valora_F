import { useId, useState } from 'react';
import { InstallGuide } from './InstallGuide';
import { useInstall } from './useInstall';
import './install.css';

// Fila de «Yo»: la instalación siempre queda a mano, aunque la franja del Inicio se haya cerrado.
export function InstallRow() {
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
