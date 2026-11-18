import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  detectPlatform,
  getInstallState,
  hideForNow,
  isHiddenForNow,
  isInstalled,
  isMobileDevice,
  type Platform,
  promptInstall,
  subscribeInstall,
} from './install';

export interface Install {
  /** La app ya está instalada (abierta desde el ícono o instalada en esta sesión). */
  installed: boolean;
  /** El navegador dio el evento: «Instalar Valora» abre su cuadro de instalación. */
  canPrompt: boolean;
  platform: Platform;
  /** La persona dijo «ahora no» hace menos de 14 días. */
  hidden: boolean;
  /** Celular o tableta: ahí vale la pena mostrar la franja sin que nadie la pida. */
  mobile: boolean;
  install: () => Promise<void>;
  hide: () => void;
}

export function useInstall(): Install {
  const store = useSyncExternalStore(subscribeInstall, getInstallState);
  const [hidden, setHidden] = useState(() => isHiddenForNow());
  const hide = useCallback(() => {
    hideForNow();
    setHidden(true);
  }, []);
  const install = useCallback(async () => {
    if ((await promptInstall()) === 'dismissed') hide();
  }, [hide]);
  return {
    installed: store.installed || isInstalled(),
    canPrompt: store.deferred !== null,
    platform: detectPlatform(),
    hidden,
    mobile: isMobileDevice(),
    install,
    hide,
  };
}
