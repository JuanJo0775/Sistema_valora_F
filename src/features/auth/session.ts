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
      // Por qué se suspendió (campo aditivo del backend: puede no venir). Ver SuspendedNotice.
      suspensionReason?: string | undefined;
      // B#133: el nombre visible, solo para la propia cuenta (las anteriores no lo tienen).
      displayName?: string | undefined;
      // ADR-029: sin el correo verificado no se pueden registrar precios.
      emailVerified: boolean;
      // ADR-029: si el servidor exige el correo verificado; con false no se muestra el aviso.
      emailVerificationRequired: boolean;
      // false: cuenta creada con Google, sin contraseña (no puede cambiarla ni confirmarla con ella).
      hasPassword: boolean;
    };

export interface SessionState {
  session: Session;
  signIn: (credentials: { email: string; password: string }) => Promise<void>;
  restoreAccount: (credentials: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  // La cuenta ya no existe: la sesión local se da por cerrada sin llamar a /auth/logout.
  endSession: () => void;
  // Se acaba de crear la primera contraseña: la sesión local ya la tiene, sin volver a pedirla.
  passwordCreated: () => void;
  // El servidor guardó un nombre nuevo: la sesión local lo muestra en toda la app sin recargar.
  nameChanged: (displayName: string) => void;
  reload: () => void;
  refreshRole: (expectedRole: Role) => void;
}

export const SessionContext = createContext<SessionState>({
  session: { status: 'loading' },
  signIn: () => Promise.resolve(),
  restoreAccount: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  endSession: () => undefined,
  passwordCreated: () => undefined,
  nameChanged: () => undefined,
  reload: () => undefined,
  refreshRole: () => undefined,
});

export const useSession = () => useContext(SessionContext);
