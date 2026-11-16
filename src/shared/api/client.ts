import createClient from 'openapi-fetch';
import type { paths } from './schema';

type Fetch = (input: Request) => Promise<Response>;

// Forma única de error de la API (contrato: Error); la pantalla decide qué mostrar según code.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  // Solo en 429: cuántos segundos esperar antes de reintentar (cabecera Retry-After).
  readonly retryAfterSeconds: number | undefined;

  constructor(details: {
    status: number;
    code: string;
    message: string;
    retryAfterSeconds?: number;
  }) {
    super(details.message);
    this.name = 'ApiError';
    this.status = details.status;
    this.code = details.code;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

// Siempre el mismo sitio que la app: en desarrollo, el proxy de Vite reenvía /v1 al backend; en
// producción, una regla de Vercel (ADR-012). Así viaja la cookie de sesión (SameSite=Lax).
export function createApiClient(options: { fetch?: Fetch } = {}) {
  const baseUrl = `${window.location.origin}/v1`;
  const send: Fetch = options.fetch ?? ((input) => fetch(input));
  const client = createClient<paths>({ baseUrl, credentials: 'same-origin', fetch: send });
  let csrfToken: string | undefined;

  const currentCsrfToken = async (): Promise<string | undefined> => {
    if (csrfToken) return csrfToken;
    const session = await send(
      new Request(`${baseUrl}/auth/session`, { credentials: 'same-origin' }),
    );
    if (!session.ok) return undefined;
    csrfToken = ((await session.json()) as { csrfToken?: string }).csrfToken;
    return csrfToken;
  };

  // ADR-014: las rutas con sesión que modifican datos exigen X-CSRF-Token. Lo entrega
  // GET /auth/session y se guarda solo en memoria. Iniciar sesión y registrarse no lo necesitan.
  client.use({
    async onRequest({ request }) {
      if (!needsCsrf(request, baseUrl)) return request;
      const token = await currentCsrfToken();
      if (token) request.headers.set('X-CSRF-Token', token);
      return request;
    },
    onResponse({ request, response }) {
      // Iniciar o cerrar sesión cambia la sesión: el token anterior ya no sirve.
      if (response.ok && SESSION_CHANGES.has(pathOf(request, baseUrl))) csrfToken = undefined;
      return response;
    },
  });
  return client;
}

const WITHOUT_SESSION = new Set(['/auth/login', '/auth/register']);
const SESSION_CHANGES = new Set(['/auth/login', '/auth/logout']);

function pathOf(request: Request, baseUrl: string): string {
  return request.url.slice(baseUrl.length).split('?')[0] ?? '';
}

function needsCsrf(request: Request, baseUrl: string): boolean {
  if (request.method === 'GET' || request.method === 'HEAD') return false;
  return !WITHOUT_SESSION.has(pathOf(request, baseUrl));
}

interface ErrorBody {
  code?: unknown;
  message?: unknown;
}

export async function call<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: Awaited<typeof request>;
  try {
    result = await request;
  } catch {
    // fetch solo falla así cuando no hay red o el servidor no contesta.
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'No hay conexión con Valora. Revisa tu internet e inténtalo de nuevo.',
    });
  }
  const { data, error, response } = result;
  if (!response.ok) {
    const body = (error ?? {}) as ErrorBody;
    const retryAfter = Number(response.headers.get('Retry-After'));
    throw new ApiError({
      status: response.status,
      code: typeof body.code === 'string' ? body.code : 'REQUEST_ERROR',
      message: typeof body.message === 'string' ? body.message : 'La API respondió con un error.',
      ...(retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
    });
  }
  // 204 (por ejemplo, iniciar o cerrar sesión): no hay cuerpo.
  return data as T;
}
