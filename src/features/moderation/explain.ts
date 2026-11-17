import { ApiError } from '../../shared/api';

// Mensajes propios por código de error o, si no hay, por estado HTTP («404»).
export const explainWith =
  (messages: Partial<Record<string, string>>) =>
  (error: unknown): string | null =>
    (error instanceof ApiError && (messages[error.code] ?? messages[String(error.status)])) || null;
