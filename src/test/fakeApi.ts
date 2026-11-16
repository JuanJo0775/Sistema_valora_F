import { vi } from 'vitest';

export interface FakeReply {
  status: number;
  body?: unknown;
}

// Backend falso para las pantallas: reemplaza fetch (la frontera con la API) y responde según
// «MÉTODO /v1/ruta». Guarda las URL pedidas (requested) y cada llamada con su método, su cuerpo y sus cabeceras
// (calls) para revisar qué se envió. Con una lista de respuestas, cada llamada usa la siguiente y la
// última se repite (por ejemplo, sin sesión antes de entrar y con sesión después).
export function stubApi(routes: Record<string, FakeReply | FakeReply[]>) {
  const requested: URL[] = [];
  const calls: { method: string; path: string; body: string; headers: Headers }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      requested.push(url);
      calls.push({
        method: input.method,
        path: url.pathname,
        body: await input.clone().text(),
        headers: input.headers,
      });
      const reply = nextReply(routes[`${input.method} ${url.pathname}`]);
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return { requested, calls };
}

const NOT_FOUND: FakeReply = { status: 404, body: { code: 'NOT_FOUND', message: 'No existe.' } };

function nextReply(route: FakeReply | FakeReply[] | undefined): FakeReply {
  if (!Array.isArray(route)) return route ?? NOT_FOUND;
  if (route.length > 1) return route.shift() ?? NOT_FOUND;
  return route[0] ?? NOT_FOUND;
}

// Respuestas de sesión que usan muchas pruebas.
export const NO_SESSION: FakeReply = {
  status: 401,
  body: { code: 'UNAUTHORIZED', message: 'Se requiere sesión.' },
};

export const sessionAs = (role: string, suspendedUntil?: string): FakeReply => ({
  status: 200,
  body: { role, csrfToken: 'token-1', suspendedUntil },
});

// Una API que todavía no responde (para ver «Cargando…»), salvo las rutas indicadas.
export function stubPendingApi(answered: Record<string, FakeReply> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: Request) => {
      const reply = answered[`${input.method} ${new URL(input.url).pathname}`];
      if (!reply) return new Promise<Response>(() => undefined);
      return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status }));
    }),
  );
}
