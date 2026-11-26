import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

type Listener = (event: Record<string, unknown>) => void;

// El manejador es JavaScript simple (public/push-handler.js): el service worker lo carga con
// importScripts. Aquí se ejecuta con un `self` falso para ver qué hace.
function load(
  windows: { focus: () => Promise<unknown>; navigate?: (url: string) => Promise<unknown> }[] = [],
) {
  const listeners = new Map<string, Listener>();
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const self = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options });
        return Promise.resolve();
      },
    },
    clients: {
      matchAll: vi.fn(() => Promise.resolve([])),
      openWindow: vi.fn(() => Promise.resolve()),
    },
  };
  new Function('self', readFileSync('public/push-handler.js', 'utf8'))(self);
  const push = async (data: unknown) => {
    const waits: Promise<unknown>[] = [];
    listeners.get('push')?.({
      data: data === undefined ? null : { json: () => data },
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    });
    await Promise.all(waits);
  };
  const click = async (url: unknown) => {
    const waits: Promise<unknown>[] = [];
    const close = vi.fn();
    listeners.get('notificationclick')?.({
      notification: { close, data: { url } },
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    });
    await Promise.all(waits);
    return { close };
  };
  return { self, shown, push, click, listeners };
}

// ADR-044: el aviso es genérico y lleva a la pantalla que se abre al tocarlo.
describe('manejador de avisos push del service worker (ADR-044)', () => {
  it('muestra la notificación con el texto, la etiqueta y la dirección que manda el servidor', async () => {
    const { shown, push } = load();

    await push({
      title: 'Valora',
      body: 'Hay casos nuevos para revisar en Precios',
      url: '/moderacion?vista=precios',
      tag: 'moderacion-precios',
    });

    expect(shown).toEqual([
      {
        title: 'Valora',
        options: expect.objectContaining({
          body: 'Hay casos nuevos para revisar en Precios',
          tag: 'moderacion-precios',
          icon: '/icon-192.png',
          data: { url: '/moderacion?vista=precios' },
        }) as unknown,
      },
    ]);
  });

  // Los navegadores exigen mostrar algo con cada push; si no, muestran un aviso propio y confuso.
  it.each([
    ['sin contenido', undefined],
    ['con un contenido que no es un objeto', 'texto suelto'],
    ['con un objeto vacío', {}],
  ])('un push %s muestra igual un aviso genérico que lleva al inicio', async (_name, data) => {
    const { shown, push } = load();

    await push(data);

    expect(shown).toEqual([
      {
        title: 'Valora',
        options: expect.objectContaining({
          body: 'Tienes avisos nuevos',
          data: { url: '/' },
        }) as unknown,
      },
    ]);
  });

  // Un aviso nunca debe sacar a la persona del sitio: solo se abren direcciones de la propia app.
  it.each([
    ['otro sitio', 'https://sitio-ajeno.example/pagina'],
    ['una dirección sin origen propio', '//sitio-ajeno.example/pagina'],
    ['un esquema peligroso', 'javascript:alert(1)'],
  ])('si la dirección apunta a %s, abre el inicio', async (_name, url) => {
    const { shown, push } = load();

    await push({ title: 'Valora', body: 'Aviso', url });

    expect(shown[0]?.options['data']).toEqual({ url: '/' });
  });

  // Tocar el aviso lleva a la pantalla correspondiente (EC-09), sin dejar la notificación abierta.
  it('al tocar el aviso lo cierra y abre la pantalla en una ventana nueva si la app no estaba abierta', async () => {
    const { self, click } = load([]);

    const { close } = await click('/moderacion?vista=precios');

    expect(close).toHaveBeenCalled();
    expect(self.clients.openWindow).toHaveBeenCalledWith('/moderacion?vista=precios');
  });

  it('si la app ya estaba abierta, la enfoca y la lleva a esa pantalla', async () => {
    const focus = vi.fn(() => Promise.resolve());
    const navigate = vi.fn(() => Promise.resolve());
    const { self, click } = load([{ focus, navigate }]);

    await click('/comercios');

    expect(navigate).toHaveBeenCalledWith('/comercios');
    expect(focus).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });
});
