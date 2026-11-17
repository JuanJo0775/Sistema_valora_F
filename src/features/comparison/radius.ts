import { readStored, writeStored } from '../../shared/storage';

// ADR-019: el radio de búsqueda es uno solo para Inicio, comparación y mapa, y el dispositivo lo
// recuerda. Va de 0,5 a 3 km (los límites del contrato: fuera de eso el servidor responde 400), de
// 0,1 en 0,1 km con la barra; los chips son preajustes. 1,5 km por defecto (la canasta del Inicio).
export const RADII = [0.5, 1, 1.5, 2, 3];
export const MIN_RADIUS_KM = 0.5;
export const MAX_RADIUS_KM = 3;
export const RADIUS_STEP_KM = 0.1;
export const DEFAULT_RADIUS_KM = 1.5;
const KEY = 'valora:radio';

// A décimas de km, dentro de los límites: evita 1,2000000000000002 y valores fuera del contrato.
export const normalizeRadius = (radiusKm: number): number =>
  Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Math.round(radiusKm * 10) / 10));

export function readRadius(): number {
  const saved = Number(readStored(KEY));
  const valid = Number.isFinite(saved) && saved >= MIN_RADIUS_KM && saved <= MAX_RADIUS_KM;
  return valid ? normalizeRadius(saved) : DEFAULT_RADIUS_KM;
}

export const saveRadius = (radiusKm: number) => {
  writeStored(KEY, String(radiusKm));
};

export const radiusLabel = (radiusKm: number) => `${String(radiusKm).replace('.', ',')} km`;

// Para el lector de pantalla: «1,5 kilómetros».
export const radiusSpoken = (radiusKm: number) =>
  `${String(radiusKm).replace('.', ',')} ${radiusKm === 1 ? 'kilómetro' : 'kilómetros'}`;
