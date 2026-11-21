import { POLICY_VERSION } from '../legal/policy';
import { safeReturn } from './safeReturn';

// Iniciar con Google es una navegación completa del navegador (no un fetch): el servidor redirige a
// Google y, al volver, a `returnTo` con la cookie de sesión puesta.
export function googleStartUrl(returnTo: string): string {
  const query = new URLSearchParams({
    acceptPolicy: POLICY_VERSION,
    returnTo: safeReturn(returnTo),
  });
  return `/v1/auth/google/start?${query.toString()}`;
}
