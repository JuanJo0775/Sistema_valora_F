import type { Store } from './StorePicker';

// Solo la tienda, que es un dato público del directorio; nunca la ubicación de quien reporta (EC-08).
// El navegador puede negar el almacenamiento (modo privado): entonces simplemente no se recuerda.
const KEY = 'valora:ultima-tienda';

export function readLastStore(): Store | null {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? (JSON.parse(saved) as Store) : null;
  } catch {
    return null;
  }
}

export function saveLastStore(store: Store) {
  try {
    // La distancia era desde donde estaba esa vez: no sirve para el próximo reporte.
    localStorage.setItem(KEY, JSON.stringify({ ...store, distanceM: undefined }));
  } catch {
    // Sin almacenamiento, el siguiente reporte vuelve a pedir la tienda.
  }
}
