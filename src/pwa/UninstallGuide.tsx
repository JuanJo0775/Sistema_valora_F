import type { ReactNode } from 'react';
import type { Platform } from './install';

// Los navegadores no dejan desinstalar una app desde el código de la página: solo se puede explicar
// cómo hacerlo en cada dispositivo. Los nombres de los menús cambian un poco entre versiones.

export type UninstallDevice = 'pc' | 'android' | 'ios';

export const deviceOf = (platform: Platform): UninstallDevice =>
  platform === 'android' ? 'android' : platform === 'other' ? 'pc' : 'ios';

const DEVICES: { id: UninstallDevice; title: string; steps: () => ReactNode }[] = [
  {
    id: 'pc',
    title: 'Computador (Windows, Mac o Linux)',
    steps: () => (
      <>
        <p>
          <strong>Con la app abierta en su ventana (Chrome o Edge):</strong>
        </p>
        <ol className="install-steps">
          <li>
            Abre Valora desde su ícono y toca el menú de <strong>tres puntos</strong> en la esquina
            superior derecha de la ventana de la app.
          </li>
          <li>
            Elige <strong>Desinstalar Valora…</strong> (en Chrome) o <strong>Desinstalar</strong>{' '}
            (en Edge).
          </li>
          <li>
            Confirma. Puedes marcar la casilla opcional para{' '}
            <strong>borrar también los datos</strong> del sitio.
          </li>
        </ol>
        <p>
          <strong>Desde Windows:</strong>
        </p>
        <ol className="install-steps">
          <li>
            Abre <strong>Configuración</strong> &gt; <strong>Aplicaciones</strong> &gt;{' '}
            <strong>Aplicaciones instaladas</strong>.
          </li>
          <li>
            Busca <strong>Valora</strong>, abre sus tres puntos y elige <strong>Desinstalar</strong>
            . Las apps de Chrome y de Edge aparecen ahí.
          </li>
        </ol>
        <p>
          <strong>Mac o Linux:</strong> en Chrome escribe <code>chrome://apps</code> en la barra de
          direcciones, haz clic derecho sobre Valora y elige <strong>Quitar de Chrome</strong>; o
          usa el menú de la ventana de la app. Los nombres pueden variar según la versión del
          navegador.
        </p>
      </>
    ),
  },
  {
    id: 'android',
    title: 'Android',
    steps: () => (
      <ol className="install-steps">
        <li>
          Mantén pulsado el ícono de <strong>Valora</strong> en la pantalla de inicio.
        </li>
        <li>
          Elige <strong>Desinstalar</strong>. Si no aparece, toca{' '}
          <strong>Información de la app</strong> y luego <strong>Desinstalar</strong>.
        </li>
        <li>Confirma con Aceptar.</li>
      </ol>
    ),
  },
  {
    id: 'ios',
    title: 'iPhone y iPad',
    steps: () => (
      <ol className="install-steps">
        <li>
          Mantén pulsado el ícono de <strong>Valora</strong> en la pantalla de inicio.
        </li>
        <li>
          Toca <strong>Eliminar app</strong>.
        </li>
        <li>
          Elige <strong>Eliminar de la pantalla de inicio</strong>.
        </li>
      </ol>
    ),
  },
];

// El dispositivo detectado va primero y abierto; los demás, plegados.
export function UninstallGuide({ device }: { device: UninstallDevice }) {
  const ordered = [...DEVICES].sort((a, b) => Number(b.id === device) - Number(a.id === device));
  return (
    <div className="uninstall-guide">
      {ordered.map(({ id, title, steps }) => (
        <details key={id} open={id === device} className="uninstall-device">
          <summary>
            <span>
              {title}
              {id === device && <span className="muted"> (este dispositivo)</span>}
            </span>
          </summary>
          {steps()}
        </details>
      ))}
    </div>
  );
}
