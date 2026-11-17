import { readStored, writeStored } from '../../shared/storage';
import { type Municipality, MUNICIPALITIES } from './criteria';

// #15: el municipio de la última comparación, para la comparación y el detalle. No es un dato
// personal (es uno de los 12 del Quindío). Por defecto Armenia, donde están las tiendas de la semilla.
const KEY = 'valora:municipio';

export function readMunicipality(): Municipality {
  const saved = readStored(KEY);
  return saved && saved in MUNICIPALITIES ? (saved as Municipality) : 'armenia';
}

export const saveMunicipality = (municipality: Municipality) => {
  writeStored(KEY, municipality);
};
