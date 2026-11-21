import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from '../../shared/storage';

// Si el aviso de cookies sigue pendiente. Lo leen el propio aviso y el aviso de instalar, que espera a
// que el de cookies se cierre para no apilarse con él.
export const COOKIE_KEY = 'valora:aviso-cookies';
// Sin almacenamiento (modo privado) el cierre se recuerda solo mientras la app sigue abierta.
let dismissedHere = false;
const listeners = new Set<() => void>();

export const isCookieNoticePending = () => !dismissedHere && readStored(COOKIE_KEY) !== '1';

export function dismissCookieNotice() {
  writeStored(COOKIE_KEY, '1');
  if (readStored(COOKIE_KEY) !== '1') dismissedHere = true;
  listeners.forEach((listener) => {
    listener();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useCookieNoticePending = () => useSyncExternalStore(subscribe, isCookieNoticePending);
