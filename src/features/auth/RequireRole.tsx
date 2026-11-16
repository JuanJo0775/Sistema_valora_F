import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { withReturn } from './safeReturn';
import { type Role, useSession } from './session';

// Guía de pantalla, no de seguridad: el servidor vuelve a verificar el rol en cada ruta (ADR-014).
export function RequireRole({
  role,
  children,
}: {
  role: Role;
  allowSuspended?: boolean;
  children: ReactNode;
}) {
  const { session, reload } = useSession();
  const { pathname, search } = useLocation();
  if (session.status === 'loading') return <Loading />;
  if (session.status === 'unknown') return <ErrorState error={session.error} onRetry={reload} />;
  if (session.status === 'anonymous') {
    return <Navigate to={withReturn('/entrar', pathname + search)} replace />;
  }
  if (session.role !== role) {
    return <EmptyState title={`Esta sección es para cuentas de ${role}`} />;
  }
  return children;
}
