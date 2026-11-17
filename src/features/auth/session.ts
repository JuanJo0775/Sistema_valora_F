import { createContext, useContext } from 'react';
import type { paths } from '../../shared/api/schema';

type SessionBody = paths['/auth/session']['get']['responses'][200]['content']['application/json'];
export type Role = SessionBody['role'];

// Lo que la app sabe de quien la usa. El csrfToken no vive aquí: lo guarda el cliente de la API.
export type Session =
  | { status: 'loading' }
  | { status: 'anonymous' }
  // Sin respuesta del servidor (sin red, error 500): no se sabe si hay sesión.
  | { status: 'unknown'; error: unknown; lastRole: Role | null }
  | {
      status: 'active';
      role: Role;
      suspendedUntil?: string | undefined;
      // B#133: el nombre visible, solo para la propia cuenta (las anteriores no lo tienen).
      displayName?: string | undefined;
      // ADR-029: sin el correo verificado no se pueden registrar precios.
      emailVerified: boolean;
      // ADR-029: si el servidor exige el correo verificado; con false no se muestra el aviso.
      emailVerificationRequired: boolean;
    };

export interface SessionState {
  session: Session;
  signIn: (credentials: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => void;
}

export const SessionContext = createContext<SessionState>({
  session: { status: 'loading' },
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  reload: () => undefined,
});

export const useSession = () => useContext(SessionContext);
