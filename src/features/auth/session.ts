import { createContext, useContext } from 'react';
import type { paths } from '../../shared/api/schema';

type SessionBody = paths['/auth/session']['get']['responses'][200]['content']['application/json'];
export type Role = SessionBody['role'];

// Lo que la app sabe de quien la usa. El csrfToken no vive aquí: lo guarda el cliente de la API.
export type Session =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'active'; role: Role; suspendedUntil?: string | undefined };

export const SessionContext = createContext<Session>({ status: 'loading' });

export const useSession = () => useContext(SessionContext);
