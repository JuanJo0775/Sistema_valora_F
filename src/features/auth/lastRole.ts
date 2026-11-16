import type { Role } from './session';

// #26: solo el rol con el que se entró la última vez, para dejar registrar sin red. No es un
// secreto (el servidor vuelve a verificarlo al sincronizar); nunca la contraseña ni el token.
const KEY = 'valora:ultimo-rol';

export function readLastRole(): Role | null {
  try {
    return localStorage.getItem(KEY) as Role | null;
  } catch {
    return null;
  }
}

export function saveLastRole(role: Role | null) {
  try {
    if (role) localStorage.setItem(KEY, role);
    else localStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento, sin red simplemente no se puede registrar.
  }
}
