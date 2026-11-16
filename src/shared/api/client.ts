import createClient from 'openapi-fetch';
import type { paths } from './schema';

type Fetch = (input: Request) => Promise<Response>;

// Forma única de error de la API (contrato: Error); la pantalla decide qué mostrar según code.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(details: { status: number; code: string; message: string }) {
    super(details.message);
    this.name = 'ApiError';
    this.status = details.status;
    this.code = details.code;
  }
}

// Siempre el mismo sitio que la app: en desarrollo, el proxy de Vite reenvía /v1 al backend; en
// producción, una regla de Vercel (ADR-012). Así viaja la cookie de sesión (SameSite=Lax).
export function createApiClient(options: { fetch?: Fetch } = {}) {
  return createClient<paths>({
    baseUrl: `${window.location.origin}/v1`,
    credentials: 'same-origin',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}

interface ErrorBody {
  code?: unknown;
  message?: unknown;
}

export async function call<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok || data === undefined) {
    const body = (error ?? {}) as ErrorBody;
    throw new ApiError({
      status: response.status,
      code: typeof body.code === 'string' ? body.code : 'REQUEST_ERROR',
      message: typeof body.message === 'string' ? body.message : 'La API respondió con un error.',
    });
  }
  return data;
}
