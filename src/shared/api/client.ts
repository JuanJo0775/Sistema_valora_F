import createClient from 'openapi-fetch';
import type { paths } from './schema';

type Fetch = (input: Request) => Promise<Response>;

// Siempre el mismo sitio que la app: en desarrollo, el proxy de Vite reenvía /v1 al backend; en
// producción, una regla de Vercel (ADR-012). Así viaja la cookie de sesión (SameSite=Lax).
export function createApiClient(options: { fetch?: Fetch } = {}) {
  return createClient<paths>({
    baseUrl: `${window.location.origin}/v1`,
    credentials: 'same-origin',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}

export async function call<T>(request: Promise<{ data?: T }>): Promise<T> {
  const { data } = await request;
  if (data === undefined) throw new Error('La API no devolvió datos');
  return data;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(_details: { status: number; code: string; message: string }) {
    super('Sin implementar');
    this.status = 0;
    this.code = '';
  }
}
