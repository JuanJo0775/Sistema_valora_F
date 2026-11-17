import { readStored, writeStored } from './storage';

// #79 y #28: el modo prueba de usabilidad muestra un cronómetro al registrar, para medir la meta de
// EC-01 (15 s) con personas reales. Es solo para el equipo y se quita al cerrar la #28.
const KEY = 'valora:modo-prueba';

export const isUsabilityMode = () => readStored(KEY) === '1';

export function setUsabilityMode(on: boolean) {
  writeStored(KEY, on ? '1' : null);
}
