import createClient from 'openapi-fetch';
import type { paths } from './schema';

export function createApiClient(_options: { fetch?: (input: Request) => Promise<Response> } = {}) {
  return createClient<paths>();
}

export function call<T>(_request: Promise<{ data?: T }>): Promise<T> {
  return Promise.reject(new Error('Sin implementar'));
}
