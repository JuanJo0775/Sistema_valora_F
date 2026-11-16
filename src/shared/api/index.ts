import { createApiClient } from './client';

// Interfaz pública del cliente de la API: las pantallas importan solo de aquí.
export { ApiError, call } from './client';
export const api = createApiClient();
