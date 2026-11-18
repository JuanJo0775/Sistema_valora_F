import { readStored, writeStored } from '../../shared/storage';
import { safeReturn } from './safeReturn';

// H-02: el enlace del correo abre otra pestaña (o la app instalada) y la persona pierde lo que
// estaba haciendo (por ejemplo, registrar el precio de un producto). El contrato del enlace solo
// lleva el token, así que a dónde volver se guarda en este navegador (localStorage: sessionStorage
// no cruza a la pestaña nueva) cuando se pide el correo o el reenvío. Es solo una ruta de la app,
// validada con safeReturn: ningún dato personal.
const KEY = 'valora:verificar-volver';

// Pantallas de la cuenta: volver a ellas no es «seguir» con nada.
const NOT_A_TASK = ['/yo', '/entrar', '/crear-cuenta', '/verificar-correo'];

const isTask = (path: string) =>
  path !== '/' && !NOT_A_TASK.some((page) => path === page || /^\/[^?#]*/.exec(path)?.[0] === page);

export function rememberVerifyReturn(path: string | null | undefined) {
  const safe = safeReturn(path ?? null);
  if (isTask(safe)) writeStored(KEY, safe);
}

const LABELS: [prefix: string, label: string][] = [
  ['/registrar', 'registrar un precio'],
  ['/proponer/producto', 'proponer un producto'],
  ['/proponer/tienda', 'proponer una tienda'],
];

export function readVerifyReturn(): { path: string; label: string } | null {
  const path = safeReturn(readStored(KEY));
  if (!isTask(path)) return null;
  const pathname = /^\/[^?#]*/.exec(path)?.[0] ?? path;
  const label = LABELS.find(([prefix]) => pathname === prefix)?.[1] ?? 'lo que estabas haciendo';
  return { path, label };
}

export const forgetVerifyReturn = () => {
  writeStored(KEY, null);
};
