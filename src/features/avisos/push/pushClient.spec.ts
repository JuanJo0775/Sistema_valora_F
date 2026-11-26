import { describe, expect, it, vi } from 'vitest';
import { type PushDeps, activatePush } from './pushClient';

// Un navegador falso: guarda lo que pasó para revisarlo.
function setup(overrides: Partial<PushDeps> = {}) {
  const subscribed: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }[] = [];
  const saved: unknown[] = [];
  const unsubscribed: string[] = [];
  const subscription = {
    endpoint: 'https://push.example.net/dispositivo',
    toJSON: () => ({
      endpoint: 'https://push.example.net/dispositivo',
      keys: { p256dh: 'clave-publica', auth: 'secreto' },
    }),
    unsubscribe: () => {
      unsubscribed.push('https://push.example.net/dispositivo');
      return Promise.resolve(true);
    },
  };
  const deps: PushDeps = {
    requestPermission: () => Promise.resolve('granted'),
    fetchKey: () => Promise.resolve('AQID'),
    registration: () =>
      Promise.resolve({
        pushManager: {
          getSubscription: () => Promise.resolve(null),
          subscribe: (options) => {
            subscribed.push(options);
            return Promise.resolve(subscription);
          },
        },
      }),
    save: (sub) => {
      saved.push(sub);
      return Promise.resolve();
    },
    remove: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  return { deps, subscribed, saved, unsubscribed };
}

// ADR-044, ADR-045: activar los avisos pide el permiso al tocar el botón, se suscribe con la clave
// pública del servidor y le entrega la suscripción.
describe('activar los avisos push en este dispositivo (ADR-045)', () => {
  it('pide el permiso, se suscribe con la clave del servidor y guarda la suscripción', async () => {
    const { deps, subscribed, saved } = setup();

    await expect(activatePush(deps)).resolves.toBe('activo');

    expect(subscribed).toHaveLength(1);
    expect(subscribed[0]?.userVisibleOnly).toBe(true);
    // 'AQID' es la clave en base64url: los bytes 1, 2 y 3.
    expect([...(subscribed[0]?.applicationServerKey ?? [])]).toEqual([1, 2, 3]);
    expect(saved).toEqual([
      {
        endpoint: 'https://push.example.net/dispositivo',
        keys: { p256dh: 'clave-publica', auth: 'secreto' },
      },
    ]);
  });
});
