import { InstallGuide } from '../../../pwa/InstallGuide';
import type { Platform } from '../../../pwa/install';
import type { PushStatus } from './pushStatus';

export interface PushPanelProps {
  status: PushStatus;
  busy: boolean;
  // Un mensaje en lenguaje simple si activar o desactivar falló.
  error: string | null;
  platform: Platform;
  onEnable: () => void;
  onDisable: () => void;
}

// RN7 de RF-020: le dice a la persona el paso que le falta según su dispositivo y su estado.
export function PushPanel({ status, busy, error, platform, onEnable, onDisable }: PushPanelProps) {
  // Sin saber si el servidor tiene los avisos, o sin clave configurada, la opción no existe.
  if (status === 'cargando' || status === 'sin_clave') return null;
  return (
    <section className="push-panel" aria-labelledby="push-titulo">
      <h2 id="push-titulo">Avisos en este dispositivo</h2>
      {status === 'listo' && (
        <>
          <p>
            Recibe un aviso cuando haya algo por revisar, incluso con la app cerrada. El navegador
            te pedirá permiso.
          </p>
          <button type="button" className="btn primary" disabled={busy} onClick={onEnable}>
            Activar avisos
          </button>
        </>
      )}
      {status === 'activo' && (
        <>
          <p>Avisos activados en este dispositivo.</p>
          <button type="button" className="btn" disabled={busy} onClick={onDisable}>
            Desactivar avisos
          </button>
        </>
      )}
      {status === 'ios_sin_instalar' && (
        <>
          <p>
            En iPhone, los avisos solo funcionan con Valora instalada en la pantalla de inicio.
            Sigue estos pasos:
          </p>
          <InstallGuide platform={platform} />
          <p>Después abre Valora desde su ícono y vuelve aquí para activar los avisos.</p>
        </>
      )}
      {status === 'ios_otro_navegador' && (
        <>
          <p>En iPhone, los avisos solo funcionan con la app instalada desde Safari.</p>
          <InstallGuide platform={platform} />
        </>
      )}
      {status === 'denegado' && (
        <>
          <p>Bloqueaste los avisos de Valora en este dispositivo. Para volver a permitirlos:</p>
          {platform === 'ios-safari' ? (
            <ol className="install-steps">
              <li>
                Abre los <strong>Ajustes del iPhone</strong> y entra a{' '}
                <strong>Notificaciones</strong>.
              </li>
              <li>
                Elige <strong>Valora</strong> y activa <strong>Permitir notificaciones</strong>.
              </li>
            </ol>
          ) : (
            <ol className="install-steps">
              <li>
                Toca el <strong>candado</strong> (o los ajustes del sitio) junto a la dirección de
                Valora.
              </li>
              <li>
                Entra a <strong>Permisos</strong> y activa <strong>Notificaciones</strong>.
              </li>
            </ol>
          )}
          <p>Después vuelve aquí.</p>
        </>
      )}
      {error !== null && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {status === 'sin_soporte' && (
        <p>
          Este navegador no puede mostrar avisos. Prueba con Chrome, Edge o Firefox; en iPhone, con
          Safari y la app instalada.
        </p>
      )}
    </section>
  );
}
