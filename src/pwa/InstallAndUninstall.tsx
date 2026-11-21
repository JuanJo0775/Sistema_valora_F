import { BackLink } from '../shared/ui/BackLink';
import { InstallGuide } from './InstallGuide';
import { detectPlatform } from './install';
import { deviceOf, UninstallGuide } from './UninstallGuide';
import { useInstall } from './useInstall';
import '../features/auth/auth.css';
import './install.css';

// «Yo» › Instalar y desinstalar la app. Instalar tiene botón (o pasos); desinstalar solo se puede
// explicar, porque los navegadores no lo permiten por código.
export function InstallAndUninstall() {
  const { installed, canPrompt, install } = useInstall();
  const platform = detectPlatform();
  return (
    <section className="profile install-page">
      <div className="profile-top">
        <BackLink fallback="/yo" />
        <h1>Instalar y desinstalar la app</h1>
      </div>
      {installed && (
        <p className="install-note" role="status">
          <strong>Estás usando la app instalada.</strong> Si quieres quitarla de este dispositivo,
          estos son los pasos.
        </p>
      )}
      {!installed && (
        <section className="profile-block" aria-labelledby="instalar">
          <h2 id="instalar" className="eyebrow">
            Instalar
          </h2>
          <div className="profile-card profile-pad">
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
              <InstallGuide platform={platform} />
            )}
          </div>
        </section>
      )}
      <section className="profile-block" aria-labelledby="desinstalar">
        <h2 id="desinstalar" className="eyebrow">
          Desinstalar
        </h2>
        <div className="profile-card profile-pad">
          <p>
            Tu navegador no deja que una página desinstale una app por ti, así que se hace desde el
            dispositivo.
          </p>
          <UninstallGuide device={deviceOf(platform)} />
          <p className="muted">
            Desinstalar la app no borra tu cuenta ni tus aportes. La canasta y las preferencias
            guardadas en este dispositivo se pueden borrar desde el navegador (borrar los datos del
            sitio).
          </p>
        </div>
      </section>
    </section>
  );
}
