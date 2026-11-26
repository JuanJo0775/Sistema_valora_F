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

  // Quien dijo «No» al permiso no recibe avisos, y el servidor no debe guardar nada.
  it('si bloquea el permiso no se suscribe ni guarda nada, y lo dice', async () => {
    const { deps, subscribed, saved } = setup({
      requestPermission: () => Promise.resolve('denied'),
    });

    await expect(activatePush(deps)).resolves.toBe('denegado');

    expect(subscribed).toEqual([]);
    expect(saved).toEqual([]);
  });

  // Cerrar el cuadro sin elegir deja el permiso en «default»: puede volver a intentarlo.
  it('si cierra el cuadro del permiso sin elegir, no pasa nada y puede intentarlo de nuevo', async () => {
    const { deps, subscribed, saved } = setup({
      requestPermission: () => Promise.resolve('default'),
    });

    await expect(activatePush(deps)).resolves.toBe('cancelado');

    expect(subscribed).toEqual([]);
    expect(saved).toEqual([]);
  });

  // Si el servidor no guarda la suscripción, el navegador no debe quedar suscrito: la pantalla diría
  // «activado» sin que el servidor sepa a quién avisar.
  it('si el servidor no guarda la suscripción, la deshace en el navegador y avisa del error', async () => {
    const { deps, unsubscribed } = setup({
      save: () => Promise.reject(new Error('sin red')),
    });

    await expect(activatePush(deps)).rejects.toThrow('sin red');

    expect(unsubscribed).toEqual(['https://push.example.net/dispositivo']);
  });
});
