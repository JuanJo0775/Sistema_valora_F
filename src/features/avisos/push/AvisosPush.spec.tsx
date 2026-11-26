import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionAs, stubApi } from '../../../test/fakeApi';
import { SessionProvider } from '../../auth/SessionProvider';
import { AvisosPush } from './AvisosPush';

const KEY = { status: 200, body: { publicKey: 'AQID' } };

// Un navegador con avisos push: service worker, Push y Notification, con lo que cada prueba necesite.
function fakeBrowser(options: { subscribed?: boolean; permission?: NotificationPermission } = {}) {
  const subscription = {
    endpoint: 'https://push.example.net/dispositivo',
    toJSON: () => ({
      endpoint: 'https://push.example.net/dispositivo',
      keys: { p256dh: 'clave-publica', auth: 'secreto' },
    }),
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
  const subscribe = vi.fn(() => Promise.resolve(subscription));
  const registration = {
    pushManager: {
      getSubscription: () => Promise.resolve(options.subscribed ? subscription : null),
      subscribe,
    },
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
  vi.stubGlobal('PushManager', class {});
  const requestPermission = vi.fn(() => Promise.resolve<NotificationPermission>('granted'));
  vi.stubGlobal('Notification', {
    permission: options.permission ?? 'default',
    requestPermission,
  });
  return { subscribe, subscription, requestPermission };
}

const renderPush = () =>
  render(
    <SessionProvider>
      <AvisosPush />
    </SessionProvider>,
  );

describe('avisos push en este dispositivo, con el navegador y la API (RN7)', () => {
  beforeEach(() => {
    stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/notifications/vapid-public-key': KEY,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('con el servidor listo y un navegador que soporta avisos, ofrece activarlos', async () => {
    fakeBrowser();

    renderPush();

    expect(await screen.findByRole('button', { name: 'Activar avisos' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
