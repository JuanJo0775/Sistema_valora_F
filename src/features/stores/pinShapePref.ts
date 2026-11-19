import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from '../../shared/storage';

// Preferencia de accesibilidad: distinguir los tipos de tienda también por su forma. Por defecto los
// pines son círculos y solo cambia el color. Se guarda en este navegador y se aplica al instante en
// el mapa, la leyenda, las tarjetas y la página de tienda (todos leen este mismo valor).
export const PIN_SHAPES_KEY = 'valora:pines-forma';

const listeners = new Set<() => void>();

export const readPinShapes = (): boolean => readStored(PIN_SHAPES_KEY) === '1';

export function setPinShapes(on: boolean) {
  writeStored(PIN_SHAPES_KEY, on ? '1' : null);
  listeners.forEach((listener) => {
    listener();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // Otra pestaña también puede cambiarla.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};

export const usePinShapes = (): boolean => useSyncExternalStore(subscribe, readPinShapes);
