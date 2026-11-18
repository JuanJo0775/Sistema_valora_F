import { useId, useState } from 'react';
import { InstallGuide } from './InstallGuide';
import { useInstall } from './useInstall';
import './install.css';

// Franja del Inicio: invita a instalar Valora. Va en el flujo de la página (no fija), así que no
// tapa el botón de acción, la barra de navegación ni el aviso de cookies. Se esconde si la app ya
// está instalada, en el computador sin evento de instalación y 14 días tras «Ahora no».
export function InstallStrip() {
  const { installed, canPrompt, platform, hidden, mobile, install, hide } = useInstall();
  const [open, setOpen] = useState(false);
  const guideId = useId();
  if (installed || hidden || (!canPrompt && !mobile)) return null;
  return (
    <aside className="install-strip" aria-label="Instalar la app">
      <p>Instala Valora en tu celular y ábrela como una app, sin buscar el enlace.</p>
      <div className="actions">
        {canPrompt ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              void install();
            }}
          >
            Instalar Valora
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            aria-expanded={open}
            aria-controls={guideId}
            onClick={() => {
              setOpen(!open);
            }}
          >
            Cómo instalar
          </button>
        )}
        <button type="button" className="btn ghost" onClick={hide}>
          Ahora no
        </button>
      </div>
      {!canPrompt && open && <InstallGuide platform={platform} id={guideId} />}
    </aside>
  );
}
