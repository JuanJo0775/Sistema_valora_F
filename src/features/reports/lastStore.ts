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
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Sin almacenamiento, el siguiente reporte vuelve a pedir la tienda.
  }
}
