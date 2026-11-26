import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionAs, stubApi } from '../../../test/fakeApi';
import { SessionProvider } from '../../auth/SessionProvider';
import { AvisosPush } from './AvisosPush';

const KEY = { status: 200, body: { publicKey: 'AQID' } };
const OK = { status: 204 };
const SUBSCRIPTIONS = 'POST /v1/notifications/subscriptions';

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
  let current: typeof subscription | null = options.subscribed ? subscription : null;
  const subscribe = vi.fn(() => {
    current = subscription;
    return Promise.resolve(subscription);
  });
  const registration = {
    pushManager: { getSubscription: () => Promise.resolve(current), subscribe },
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
  vi.stubGlobal('PushManager', {});
  // El permiso cambia cuando la persona acepta, como en el navegador.
  const notification = {
    permission: options.permission ?? 'default',
    requestPermission: vi.fn(() => {
      notification.permission = 'granted';
      return Promise.resolve<NotificationPermission>('granted');
    }),
  };
  vi.stubGlobal('Notification', notification);
  return { subscribe, subscription, notification };
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

  it('al activar, pide el permiso, guarda la suscripción en el servidor y ofrece desactivar', async () => {
    const { subscribe, notification } = fakeBrowser();
    const { calls } = stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/notifications/vapid-public-key': KEY,
      [SUBSCRIPTIONS]: OK,
    });
    renderPush();

    fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos' }));

    expect(await screen.findByRole('button', { name: 'Desactivar avisos' })).toBeInTheDocument();
    expect(notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    const saved = calls.find(
      ({ method, path }) => method === 'POST' && path.endsWith('subscriptions'),
    );
    expect(JSON.parse(saved?.body ?? '{}')).toEqual({
      endpoint: 'https://push.example.net/dispositivo',
      keys: { p256dh: 'clave-publica', auth: 'secreto' },
    });
  });

  it('si el servidor no guarda la suscripción, lo dice y deja volver a intentarlo', async () => {
    const { subscription } = fakeBrowser();
    stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/notifications/vapid-public-key': KEY,
      [SUBSCRIPTIONS]: { status: 500, body: { code: 'ERROR', message: 'Falló.' } },
    });
    renderPush();

    fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos activar los avisos');
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Activar avisos' })).toBeEnabled();
  });

  it('con los avisos activos, desactivarlos borra la suscripción y vuelve a ofrecer activar', async () => {
    fakeBrowser({ subscribed: true, permission: 'granted' });
    const { calls } = stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/notifications/vapid-public-key': KEY,
      'DELETE /v1/notifications/subscriptions': OK,
    });
    renderPush();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar avisos' }));

    expect(await screen.findByRole('button', { name: 'Activar avisos' })).toBeInTheDocument();
    const removed = calls.find(({ method }) => method === 'DELETE');
    expect(JSON.parse(removed?.body ?? '{}')).toEqual({
      endpoint: 'https://push.example.net/dispositivo',
    });
  });

  it('si el servidor no borra la suscripción, lo dice y sigue activo', async () => {
    fakeBrowser({ subscribed: true, permission: 'granted' });
    stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/notifications/vapid-public-key': KEY,
      'DELETE /v1/notifications/subscriptions': {
        status: 500,
        body: { code: 'ERROR', message: 'Falló.' },
      },
    });
    renderPush();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar avisos' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos desactivar los avisos');
    expect(screen.getByRole('button', { name: 'Desactivar avisos' })).toBeInTheDocument();
  });

  it('si el servidor no tiene los avisos configurados, no muestra nada', async () => {
    fakeBrowser();
    stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/notifications/vapid-public-key': {
        status: 404,
        body: { code: 'NOT_FOUND', message: 'No hay clave.' },
      },
    });

    renderPush();

    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('en un navegador sin avisos push, lo explica en lugar de un botón que no funciona', async () => {
    renderPush();

    expect(await screen.findByText(/Este navegador no puede mostrar avisos/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar avisos' })).not.toBeInTheDocument();
  });
});
