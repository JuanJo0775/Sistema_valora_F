import { readStored, writeStored } from '../../shared/storage';

// ADR-019: el radio de búsqueda es uno solo para Inicio, comparación y mapa, y el dispositivo lo
// recuerda. Valores fijos de 0,5 a 3 km; 1,5 km por defecto (la canasta del Inicio, B#128).
export const RADII = [0.5, 1, 1.5, 2, 3];
export const DEFAULT_RADIUS_KM = 1.5;
const KEY = 'valora:radio';

export function readRadius(): number {
  const saved = Number(readStored(KEY));
  return RADII.includes(saved) ? saved : DEFAULT_RADIUS_KM;
}

export const saveRadius = (radiusKm: number) => {
  writeStored(KEY, String(radiusKm));
};

export const radiusLabel = (radiusKm: number) => `${String(radiusKm).replace('.', ',')} km`;
