import { vi } from 'vitest';

export interface FakeReply {
  status: number;
  body?: unknown;
}

// Backend falso para las pantallas: reemplaza fetch (la frontera con la API) y responde según
// «MÉTODO /v1/ruta». Guarda las URL pedidas para revisar qué se consultó.
export function stubApi(routes: Record<string, FakeReply>) {
  const requested: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: Request) => {
      const url = new URL(input.url);
      requested.push(url);
      const reply = routes[`${input.method} ${url.pathname}`] ?? {
        status: 404,
        body: { code: 'NOT_FOUND', message: 'No existe.' },
      };
      return Promise.resolve(
        new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
          status: reply.status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
  return { requested };
}
