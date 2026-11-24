import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { OfflineMessage } from '../../shared/ui/OfflineMessage';
import { withReturn } from './safeReturn';
import { type Role, useSession } from './session';
import { SuspendedNotice } from './SuspendedNotice';

// Guía de pantalla, no de seguridad: el servidor vuelve a verificar el rol en cada ruta (ADR-014).
export function RequireRole({
  role,
  allowSuspended = false,
  allowOffline = false,
  children,
}: {
  role: Role;
  allowSuspended?: boolean;
  allowOffline?: boolean;
  children: ReactNode;
}) {
  const { session, reload } = useSession();
  const { pathname, search } = useLocation();
  if (session.status === 'loading') return <Loading />;
  if (session.status === 'unknown') {
    // #26: sin red no se sabe si la sesión sigue. Si la última vez entró con este rol, puede
    // guardar en el teléfono; el servidor verifica la sesión al sincronizar (401: pide entrar).
    if (allowOffline && session.lastRole === role) {
      return (
        <>
          <OfflineMessage>
            Sin conexión: tu reporte se guardará en el teléfono y se enviará solo.
          </OfflineMessage>
          {children}
        </>
      );
    }
    return <ErrorState error={session.error} onRetry={reload} />;
  }
  if (session.status === 'anonymous') {
    return <Navigate to={withReturn('/entrar', pathname + search)} replace />;
  }
  if (session.role !== role) {
    // Quien llega aquí con otro rol no debe quedarse sin salida: se le lleva a donde sí puede ir.
    const canRegister = role === 'comercio' && session.role === 'reportante';
    return (
      <EmptyState
        title={`Esta sección es para cuentas de ${role}`}
        action={
          canRegister ? (
            <Link to="/comercios/registro">Registrar mi tienda</Link>
          ) : (
            <Link to="/yo">Volver a Yo</Link>
          )
        }
      />
    );
  }
  if (session.suspendedUntil && !allowSuspended) {
    return <SuspendedNotice until={session.suspendedUntil} />;
  }
  return children;
}
