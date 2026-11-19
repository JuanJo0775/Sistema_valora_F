import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router';
import { useCookieNoticePending } from '../features/legal/cookieNoticeState';
import { InstallGuide } from './InstallGuide';
import { useInstall } from './useInstall';
import './install.css';

// Segundos de uso antes de ofrecer instalar: la persona primero mira lo que vino a hacer.
export const INSTALL_PROMPT_DELAY_MS = 6000;

// Aviso para instalar Valora en cualquier pantalla (una sola fuente: aquí). Es una tarjeta cerrable
// sobre la barra inferior (celular) o en la esquina (escritorio). Respeta lo fijo de abajo: espera a
// que el aviso de cookies se cierre, no sale al registrar un precio y se coloca sobre la barra de
// compra del detalle (install.css). Solo sale si hay forma de instalar: el evento del navegador o iOS.
export function InstallPrompt() {
  const { installed, canPrompt, platform, hidden, mobile, install, hide } = useInstall();
  const { pathname } = useLocation();
  const cookiesPending = useCookieNoticePending();
  const [waited, setWaited] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const guideId = useId();
  useEffect(() => {
    const timer = setTimeout(() => {
      setWaited(true);
    }, INSTALL_PROMPT_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  const offerable = canPrompt || platform === 'ios-safari' || platform === 'ios-other';
  const show =
    waited &&
    offerable &&
    !installed &&
    !hidden &&
    !cookiesPending &&
    !pathname.startsWith('/registrar');
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') hide();
  };
  // La región viva existe siempre: así el lector de pantalla anuncia la tarjeta cuando aparece.
  return (
    <div className="install-live" aria-live="polite">
      {show && (
        <section className="install-prompt" aria-label="Instalar la app" onKeyDown={onKeyDown}>
          <p>
            {mobile
              ? 'Instala Valora en tu celular y ábrela como una app, sin buscar el enlace.'
              : 'Instala Valora y ábrela en su propia ventana, sin buscar el enlace.'}
          </p>
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
                aria-expanded={guideOpen}
                aria-controls={guideId}
                onClick={() => {
                  setGuideOpen(!guideOpen);
                }}
              >
                Cómo instalar
              </button>
            )}
            <button type="button" className="btn ghost" onClick={hide}>
              Ahora no
            </button>
          </div>
          {!canPrompt && guideOpen && <InstallGuide platform={platform} id={guideId} />}
        </section>
      )}
    </div>
  );
}
