import { describe, expect, it } from 'vitest';
import { ApiError, call, createApiClient } from './client';

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

// Backend falso: la única frontera que se reemplaza es fetch. Guarda cada petición para revisarla.
function fakeBackend(routes: Record<string, Reply>) {
  const requests: Request[] = [];
  const fetch = (input: Request) => {
    requests.push(input);
    const url = new URL(input.url);
    const reply = routes[`${input.method} ${url.pathname}`] ?? { status: 404 };
    return Promise.resolve(
      new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json', ...reply.headers },
      }),
    );
  };
  return { fetch, requests };
}

const rice = {
  id: '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d',
  name: 'Arroz blanco',
  category: { code: 'grains-groceries', name: 'Granos y abarrotes' },
  presentations: [],
};

describe('cliente de la API', () => {
  it('buscar «arroz» devuelve los productos que responde la API', async () => {
    const backend = fakeBackend({ 'GET /v1/products': { status: 200, body: { items: [rice] } } });
    const api = createApiClient({ fetch: backend.fetch });

    const found = await call(api.GET('/products', { params: { query: { q: 'arroz' } } }));

    expect(found.items).toEqual([rice]);
    expect(new URL(backend.requests[0]?.url ?? '').search).toBe('?q=arroz');
  });

  it('un producto que no existe llega como error con el código y el mensaje del servidor', async () => {
    const backend = fakeBackend({
      [`GET /v1/products/${rice.id}`]: {
        status: 404,
        body: { code: 'NOT_FOUND', message: 'No existe el producto.' },
      },
    });
    const api = createApiClient({ fetch: backend.fetch });

    const request = call(
      api.GET('/products/{productId}', { params: { path: { productId: rice.id } } }),
    );

    await expect(request).rejects.toEqual(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'No existe el producto.' }),
    );
  });

  it('iniciar sesión responde 204 sin cuerpo y termina sin error', async () => {
    const backend = fakeBackend({ 'POST /v1/auth/login': { status: 204 } });
    const api = createApiClient({ fetch: backend.fetch });

    const request = call(
      api.POST('/auth/login', { body: { email: 'ana@correo.com', password: 'una-clave-larga' } }),
    );

    await expect(request).resolves.toBeUndefined();
  });
});
