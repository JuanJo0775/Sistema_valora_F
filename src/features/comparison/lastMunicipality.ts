import { type Municipality, MUNICIPALITIES } from './criteria';

// #15: el municipio donde se compró la última vez, para la comparación y el detalle. No es un dato
// personal (es uno de los 12 del Quindío). Por defecto Armenia, donde están las tiendas de la semilla.
const KEY = 'valora:municipio';

export function readMunicipality(): Municipality {
  try {
    const saved = localStorage.getItem(KEY);
    return saved && saved in MUNICIPALITIES ? (saved as Municipality) : 'armenia';
  } catch {
    return 'armenia';
  }
}

export function saveMunicipality(municipality: Municipality) {
  try {
    localStorage.setItem(KEY, municipality);
  } catch {
    // Sin almacenamiento, la próxima vez vuelve a Armenia.
  }
}
