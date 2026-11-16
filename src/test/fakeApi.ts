import { vi } from 'vitest';

export interface FakeReply {
  status: number;
  body?: unknown;
  // La respuesta nunca llega: para ver lo que muestra la pantalla mientras espera.
  pending?: boolean;
  headers?: Record<string, string>;
}

// Backend falso para las pantallas: reemplaza fetch (la frontera con la API) y responde según
// «MÉTODO /v1/ruta». Guarda las URL pedidas (requested) y cada llamada con su método, su cuerpo y sus cabeceras
// (calls) para revisar qué se envió. Con una lista de respuestas, cada llamada usa la siguiente y la
// última se repite. Con una función, la respuesta depende del momento (por ejemplo, de si ya se
// inició sesión), sin importar cuántas veces se consulte.
export function stubApi(routes: Record<string, FakeRoute>) {
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
      if (reply.pending) return new Promise<Response>(() => undefined);
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json', ...reply.headers },
      });
    }),
  );
  return { requested, calls };
}

const NOT_FOUND: FakeReply = { status: 404, body: { code: 'NOT_FOUND', message: 'No existe.' } };

type FakeRoute = FakeReply | FakeReply[] | (() => FakeReply);

function nextReply(route: FakeRoute | undefined): FakeReply {
  if (typeof route === 'function') return route();
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
