import { useEffect, useSyncExternalStore } from 'react';

// Estado de la conexión del navegador, compartido por los avisos de «Sin conexión».
const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};

export const useOnline = (): boolean =>
  useSyncExternalStore(subscribeOnline, () => navigator.onLine);

// H-08: un solo mensaje de «sin conexión» por pantalla. La pantalla que ya explica su propio estado
// (OfflineMessage) lo reclama y el aviso global se esconde mientras tanto.
let claims = 0;
const listeners = new Set<() => void>();
const changed = () => {
  listeners.forEach((listener) => {
    listener();
  });
};
const subscribeClaims = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

export const useOfflineClaimed = (): boolean =>
  useSyncExternalStore(subscribeClaims, () => claims > 0);

export function useClaimOfflineNotice(active = true): void {
  useEffect(() => {
    if (!active) return;
    claims += 1;
    changed();
    return () => {
      claims -= 1;
      changed();
    };
  }, [active]);
}
