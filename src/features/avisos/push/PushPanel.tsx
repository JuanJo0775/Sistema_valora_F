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
export function PushPanel({ status, busy, onEnable, onDisable }: PushPanelProps) {
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
    </section>
  );
}
