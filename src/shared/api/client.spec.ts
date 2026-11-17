import { afterEach, describe, expect, it } from 'vitest';
import { setSimulatedOffline } from '../connection';
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

const reportId = '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b';

// Marcar un precio como dudoso: la operación con sesión que usan las pruebas de CSRF.
const flagWith = (api: ReturnType<typeof createApiClient>) =>
  call(
    api.POST('/reports/{reportId}/flag', {
      params: { path: { reportId } },
      body: { reason: 'precio_falso' },
    }),
  );

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

  it('sin red llega un error NETWORK_ERROR con status 0', async () => {
    const offline = () => Promise.reject(new TypeError('Failed to fetch'));
    const api = createApiClient({ fetch: offline });

    const request = call(api.GET('/products', { params: { query: { q: 'arroz' } } }));

    await expect(request).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('demasiados intentos (429) dice en cuántos segundos se puede volver a intentar', async () => {
    const backend = fakeBackend({
      'POST /v1/auth/login': {
        status: 429,
        body: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos.' },
        headers: { 'Retry-After': '120' },
      },
    });
    const api = createApiClient({ fetch: backend.fetch });

    const request = call(
      api.POST('/auth/login', { body: { email: 'ana@correo.com', password: 'una-clave-larga' } }),
    );

    await expect(request).rejects.toMatchObject({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      retryAfterSeconds: 120,
    });
  });

  it('un reporte repetido (409 DUPLICATE_REPORT) dice desde qué hora se acepta otro', async () => {
    const backend = fakeBackend({
      'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
      'POST /v1/reports': {
        status: 409,
        body: {
          code: 'DUPLICATE_REPORT',
          message: 'Ya registraste este precio hace poco.',
          availableFrom: '2026-11-16T15:30:00Z',
        },
      },
    });
    const api = createApiClient({ fetch: backend.fetch });

    const request = call(
      api.POST('/reports', {
        params: { header: { 'Idempotency-Key': '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918' } },
        body: {
          presentationId: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b',
          establishmentId: '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
          priceCop: 2500,
          priceType: 'normal',
          observedAt: '2026-11-16T15:00:00Z',
        },
      }),
    );

    await expect(request).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE_REPORT',
      availableFrom: '2026-11-16T15:30:00Z',
    });
  });

  it('marcar un precio como dudoso envía el token CSRF de la sesión', async () => {
    const backend = fakeBackend({
      'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
      [`POST /v1/reports/${reportId}/flag`]: { status: 202 },
    });
    const api = createApiClient({ fetch: backend.fetch });

    await flagWith(api);

    const flag = backend.requests.find((request) => request.method === 'POST');
    expect(flag?.headers.get('X-CSRF-Token')).toBe('token-1');
  });

  it('pide el token CSRF una sola vez y lo reutiliza en las siguientes operaciones', async () => {
    const backend = fakeBackend({
      'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
      [`POST /v1/reports/${reportId}/flag`]: { status: 202 },
    });
    const api = createApiClient({ fetch: backend.fetch });
    const flag = () => flagWith(api);

    await flag();
    await flag();

    const sessions = backend.requests.filter((request) => request.url.endsWith('/auth/session'));
    expect(sessions).toHaveLength(1);
  });

  it('después de iniciar sesión pide un token CSRF nuevo', async () => {
    const backend = fakeBackend({
      'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
      'POST /v1/auth/login': { status: 204 },
      [`POST /v1/reports/${reportId}/flag`]: { status: 202 },
    });
    const api = createApiClient({ fetch: backend.fetch });
    const flag = () => flagWith(api);

    await flag();
    await call(
      api.POST('/auth/login', { body: { email: 'beto@correo.com', password: 'otra-clave-larga' } }),
    );
    await flag();

    const sessions = backend.requests.filter((request) => request.url.endsWith('/auth/session'));
    expect(sessions).toHaveLength(2);
  });

  it('si el servidor rechaza el token CSRF, el siguiente intento pide uno nuevo', async () => {
    const backend = fakeBackend({
      'GET /v1/auth/session': {
        status: 200,
        body: { role: 'reportante', csrfToken: 'token-viejo' },
      },
      [`POST /v1/reports/${reportId}/flag`]: {
        status: 403,
        body: { code: 'CSRF_TOKEN_INVALID', message: 'El token CSRF no es válido.' },
      },
    });
    const api = createApiClient({ fetch: backend.fetch });
    const flag = () => flagWith(api);

    await expect(flag()).rejects.toMatchObject({ status: 403, code: 'CSRF_TOKEN_INVALID' });
    await expect(flag()).rejects.toMatchObject({ code: 'CSRF_TOKEN_INVALID' });

    const sessions = backend.requests.filter((request) => request.url.endsWith('/auth/session'));
    expect(sessions).toHaveLength(2);
  });

  it('sin sesión, una operación que la exige llega como 401 UNAUTHORIZED', async () => {
    const backend = fakeBackend({
      'GET /v1/auth/session': {
        status: 401,
        body: { code: 'UNAUTHORIZED', message: 'Sin sesión.' },
      },
      [`POST /v1/reports/${reportId}/flag`]: {
        status: 401,
        body: { code: 'UNAUTHORIZED', message: 'Inicia sesión para continuar.' },
      },
    });
    const api = createApiClient({ fetch: backend.fetch });

    const request = flagWith(api);

    await expect(request).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    const flag = backend.requests.find((sent) => sent.method === 'POST');
    expect(flag?.headers.get('X-CSRF-Token')).toBeNull();
  });

  it('si la respuesta de error no es JSON (por ejemplo, un 502 del proxy), llega un error genérico', async () => {
    const proxyDown = () => Promise.resolve(new Response('Bad Gateway', { status: 502 }));
    const api = createApiClient({ fetch: proxyDown });

    const request = call(api.GET('/products', { params: { query: { q: 'arroz' } } }));

    await expect(request).rejects.toMatchObject({ status: 502, code: 'REQUEST_ERROR' });
  });
});

// #79: «Simular sin conexión» en Yo, para la demo del registro sin señal (ADR-010).
describe('simular sin conexión', () => {
  afterEach(() => {
    setSimulatedOffline(false);
  });

  it('no sale ninguna petición y la app responde como sin red', async () => {
    const backend = fakeBackend({ 'GET /v1/categories': { status: 200, body: { items: [] } } });
    const api = createApiClient({ fetch: backend.fetch });
    setSimulatedOffline(true);

    await expect(call(api.GET('/categories'))).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(backend.requests).toHaveLength(0);
  });

  it('al apagarla vuelve a pedir al servidor', async () => {
    const backend = fakeBackend({ 'GET /v1/categories': { status: 200, body: { items: [] } } });
    const api = createApiClient({ fetch: backend.fetch });
    setSimulatedOffline(true);
    setSimulatedOffline(false);

    await expect(call(api.GET('/categories'))).resolves.toEqual({ items: [] });
  });
});
