import { useCallback, useEffect, useMemo, useState } from 'react';
import { detectPlatform, isInstalled } from '../../../pwa/install';
import { api, call } from '../../../shared/api';
import { activatePush, deactivatePush, type PushDeps } from './pushClient';
import { type PushStatus, pushStatusOf } from './pushStatus';

const supportsPush = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const currentPermission = (): 'default' | 'granted' | 'denied' =>
  'Notification' in window ? Notification.permission : 'default';

// Las piezas reales: el navegador y la API de Valora (el cliente pone la cookie y el CSRF).
const realDeps: PushDeps = {
  requestPermission: () => Notification.requestPermission(),
  fetchKey: async () => (await call(api.GET('/notifications/vapid-public-key'))).publicKey,
  registration: () => navigator.serviceWorker.ready,
  save: async (subscription) => {
    await call(api.POST('/notifications/subscriptions', { body: subscription }));
  },
  remove: async (endpoint) => {
    await call(api.DELETE('/notifications/subscriptions', { body: { endpoint } }));
  },
};

export interface UsePush {
  status: PushStatus;
  busy: boolean;
  error: string | null;
  platform: ReturnType<typeof detectPlatform>;
  enable: () => void;
  disable: () => void;
}

// RN3 y RN7 de RF-020: junta lo que sabe el navegador y el servidor y expone activar y desactivar.
export function usePush(deps: PushDeps = realDeps): UsePush {
  const [keyAvailable, setKeyAvailable] = useState<boolean | undefined>(undefined);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState(currentPermission);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = supportsPush();

  useEffect(() => {
    const state = { alive: true };
    // El estado de este dispositivo y la clave del servidor se consultan sin molestar a la persona.
    void (async () => {
      const hasKey = await call(api.GET('/notifications/vapid-public-key')).then(
        () => true,
        () => false,
      );
      const has = supported
        ? await deps
            .registration()
            .then((registration) => registration.pushManager.getSubscription())
            .then((subscription) => subscription !== null)
            .catch(() => false)
        : false;
      if (!state.alive) return;
      setSubscribed(has);
      setKeyAvailable(hasKey);
    })();
    return () => {
      state.alive = false;
    };
  }, [deps, supported]);

  const run = useCallback(async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      setPermission(currentPermission());
      setBusy(false);
    }
  }, []);

  const enable = useCallback(() => {
    void run(async () => {
      const result = await activatePush(deps);
      setSubscribed(result === 'activo');
    }, 'No pudimos activar los avisos. Revisa tu conexión e inténtalo de nuevo.');
  }, [deps, run]);

  const disable = useCallback(() => {
    void run(async () => {
      await deactivatePush(deps);
      setSubscribed(false);
    }, 'No pudimos desactivar los avisos. Inténtalo de nuevo.');
  }, [deps, run]);

  const platform = detectPlatform();
  const status = useMemo(
    () =>
      pushStatusOf({
        platform,
        installed: isInstalled(),
        supported,
        permission,
        keyAvailable,
        subscribed,
      }),
    [platform, supported, permission, keyAvailable, subscribed],
  );
  return { status, busy, error, platform, enable, disable };
}
