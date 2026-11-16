import { readStored, writeStored } from '../../shared/storage';
import type { Store } from './StorePicker';

// Solo la tienda, que es un dato público del directorio; nunca la ubicación de quien reporta (EC-08).
const KEY = 'valora:ultima-tienda';

export function readLastStore(): Store | null {
  const saved = readStored(KEY);
  try {
    return saved ? (JSON.parse(saved) as Store) : null;
  } catch {
    // Un valor dañado no rompe el registro: se vuelve a elegir la tienda.
    return null;
  }
}

// La distancia era desde donde estaba esa vez: no sirve para el próximo reporte.
export const saveLastStore = (store: Store) => {
  writeStored(KEY, JSON.stringify({ ...store, distanceM: undefined }));
};
