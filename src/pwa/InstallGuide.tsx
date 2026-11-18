import type { Platform } from './install';

// Pasos para instalar cuando el navegador no ofrece el botón. Solo texto, sin imágenes.
export function InstallGuide({ platform, id }: { platform: Platform; id?: string }) {
  if (platform === 'ios-safari') {
    return (
      <ol id={id} className="install-steps">
        <li>
          Toca <strong>Compartir</strong> (el cuadrado con una flecha hacia arriba) en la barra de
          Safari.
        </li>
        <li>
          Elige <strong>Añadir a pantalla de inicio</strong>.
        </li>
        <li>
          Toca <strong>Añadir</strong>. Valora queda como una app más.
        </li>
      </ol>
    );
  }
  if (platform === 'ios-other') {
    return (
      <ol id={id} className="install-steps">
        <li>
          <strong>Ábrela en Safari</strong>: copia el enlace de esta página y pégalo en Safari.
        </li>
        <li>
          En Safari toca <strong>Compartir</strong> y elige{' '}
          <strong>Añadir a pantalla de inicio</strong>.
        </li>
      </ol>
    );
  }
  return (
    <ol id={id} className="install-steps">
      <li>
        Abre el <strong>menú del navegador</strong> (los tres puntos o el ícono de menú).
      </li>
      <li>
        Elige <strong>Instalar aplicación</strong> o <strong>Añadir a la pantalla de inicio</strong>
        .
      </li>
      <li>Si no aparece, abre Valora en Chrome o en Edge e inténtalo de nuevo.</li>
    </ol>
  );
}
