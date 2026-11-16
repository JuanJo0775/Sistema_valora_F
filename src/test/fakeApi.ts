import { vi } from 'vitest';

export interface FakeReply {
  status: number;
  body?: unknown;
}

// Backend falso para las pantallas: reemplaza fetch (la frontera con la API) y responde según
// «MÉTODO /v1/ruta». Guarda las URL pedidas (requested) y cada llamada con su método y su cuerpo
// (calls) para revisar qué se envió. Con una lista de respuestas, cada llamada usa la siguiente y la
// última se repite (por ejemplo, sin sesión antes de entrar y con sesión después).
export function stubApi(routes: Record<string, FakeReply | FakeReply[]>) {
  const requested: URL[] = [];
  const calls: { method: string; path: string; body: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      requested.push(url);
      calls.push({ method: input.method, path: url.pathname, body: await input.clone().text() });
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
