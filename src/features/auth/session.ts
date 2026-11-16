import { createContext, useContext } from 'react';
import type { paths } from '../../shared/api/schema';

type SessionBody = paths['/auth/session']['get']['responses'][200]['content']['application/json'];
export type Role = SessionBody['role'];

// Lo que la app sabe de quien la usa. El csrfToken no vive aquí: lo guarda el cliente de la API.
export type Session =
  | { status: 'loading' }
  | { status: 'anonymous' }
  // Sin respuesta del servidor (sin red, error 500): no se sabe si hay sesión.
  | { status: 'unknown'; error: unknown }
  | { status: 'active'; role: Role; suspendedUntil?: string | undefined };

export interface SessionState {
  session: Session;
  signOut: () => Promise<void>;
  reload: () => void;
}

export const SessionContext = createContext<SessionState>({
  session: { status: 'loading' },
  signOut: () => Promise.resolve(),
  reload: () => undefined,
});

export const useSession = () => useContext(SessionContext);
