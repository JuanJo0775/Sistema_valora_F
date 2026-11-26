// Lo que el navegador y la API ofrecen, detrás de un puerto para poder probar sin navegador real.
export interface PushSubscriptionLike {
  endpoint: string;
  toJSON(): { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  unsubscribe(): Promise<boolean>;
}

export interface PushDeps {
  // Pide el permiso del navegador: solo al tocar el botón, nunca al cargar la página (ADR-045).
  requestPermission(): Promise<NotificationPermission>;
  // La clave pública VAPID del servidor (GET /v1/notifications/vapid-public-key).
  fetchKey(): Promise<string>;
  registration(): Promise<{
    pushManager: {
      getSubscription(): Promise<PushSubscriptionLike | null>;
      subscribe(options: {
        userVisibleOnly: boolean;
        applicationServerKey: Uint8Array;
      }): Promise<PushSubscriptionLike>;
    };
  }>;
  // POST y DELETE /v1/notifications/subscriptions.
  save(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void>;
  remove(endpoint: string): Promise<void>;
}

// La clave VAPID viaja en base64url; el navegador la pide en bytes.
function keyToBytes(key: string): Uint8Array {
  const base64 = key
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(key.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

// ADR-044 y ADR-045: activa los avisos en este dispositivo.
export async function activatePush(deps: PushDeps): Promise<'activo' | 'denegado' | 'cancelado'> {
  const permission = await deps.requestPermission();
  if (permission === 'denied') return 'denegado';
  // Cerrar el cuadro sin elegir deja el permiso en «default»: puede volver a intentarlo.
  if (permission !== 'granted') return 'cancelado';
  const [key, registration] = await Promise.all([deps.fetchKey(), deps.registration()]);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyToBytes(key),
  });
  const { endpoint, keys } = subscription.toJSON();
  try {
    await deps.save({
      endpoint: endpoint ?? subscription.endpoint,
      keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' },
    });
  } catch (error) {
    // Sin la suscripción en el servidor, el navegador no debe quedar suscrito.
    await subscription.unsubscribe();
    throw error;
  }
  return 'activo';
}
