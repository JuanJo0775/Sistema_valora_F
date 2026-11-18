import { readStored, writeStored } from '../../shared/storage';
import type { Comparison } from './AllStores';

// H-08: la última comparación vista de cada producto, para verla sin conexión. Solo se guarda la
// que se pidió por municipio: la que se pidió con la ubicación (lat, lng) nunca se guarda, porque
// el backend la marca no-store por privacidad (EC-08) y de ella podría deducirse dónde estuvo la
// persona. Tampoco hay datos de quién reportó (EC-08). Son pocas entradas y vencen.
const KEY = 'valora:comparaciones';
const MAX_ENTRIES = 8;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

type Entry = { key: string; savedAt: number; comparison: Comparison };

const read = (): Entry[] => {
  try {
    const parsed: unknown = JSON.parse(readStored(KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as Entry[]) : [];
  } catch {
    return [];
  }
};

// La consulta que identifica una comparación sin ubicación; con ubicación no hay clave.
export const comparisonKey = (parts: {
  productId: string;
  located: boolean;
  where: string;
  sort: string;
  onlyCurrent: boolean;
}): string | null =>
  parts.located
    ? null
    : `${parts.productId}|${parts.where}|${parts.sort}|${String(parts.onlyCurrent)}`;

export function saveComparison(key: string | null, comparison: Comparison, now = Date.now()) {
  if (!key) return;
  const others = read().filter((entry) => entry.key !== key);
  writeStored(
    KEY,
    JSON.stringify([{ key, savedAt: now, comparison }, ...others].slice(0, MAX_ENTRIES)),
  );
}

export function readComparison(
  key: string | null,
  now = Date.now(),
): { comparison: Comparison; savedAt: number } | null {
  if (!key) return null;
  const found = read().find((entry) => entry.key === key);
  return found && now - found.savedAt <= MAX_AGE_MS
    ? { comparison: found.comparison, savedAt: found.savedAt }
    : null;
}

// «hace un momento», «hace 5 min», «hace 3 h», «hace 2 días».
export function ago(savedAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - savedAt) / 60_000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${String(minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${String(hours)} h`;
  const days = Math.round(hours / 24);
  return `hace ${String(days)} ${days === 1 ? 'día' : 'días'}`;
}
