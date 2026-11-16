import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { withReturn } from './safeReturn';
import { type Role, useSession } from './session';

// Guía de pantalla, no de seguridad: el servidor vuelve a verificar el rol en cada ruta (ADR-014).
export function RequireRole({ children }: { role: Role; children: ReactNode }) {
  const { session } = useSession();
  const { pathname, search } = useLocation();
  if (session.status === 'anonymous') {
    return <Navigate to={withReturn('/entrar', pathname + search)} replace />;
  }
  return children;
}
