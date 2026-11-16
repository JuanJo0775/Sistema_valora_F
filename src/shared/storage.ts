// Preferencias de este navegador (la última tienda, el último rol, el municipio). El navegador puede
// negar el almacenamiento (modo privado): entonces no se recuerda nada y la app sigue funcionando.
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento, simplemente no se recuerda.
  }
}
