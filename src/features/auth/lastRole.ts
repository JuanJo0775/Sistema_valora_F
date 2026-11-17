import { readStored, writeStored } from '../../shared/storage';
import type { Role } from './session';

// #26: solo el rol con el que se entró la última vez, para dejar registrar sin red. No es un
// secreto (el servidor vuelve a verificarlo al sincronizar); nunca la contraseña ni el token.
const KEY = 'valora:ultimo-rol';

export const readLastRole = () => readStored(KEY) as Role | null;

export const saveLastRole = (role: Role | null) => {
  writeStored(KEY, role);
};
