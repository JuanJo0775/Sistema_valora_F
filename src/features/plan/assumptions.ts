import { readStored, writeStored } from '../../shared/storage';
import { DEFAULT_ASSUMPTIONS, type TravelAssumptions } from './travel';

// Los supuestos del traslado se recuerdan en este navegador (no son datos personales).
const KEY = 'valora:plan-supuestos';
const VERSION = 1;

const isAmount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;

// Un valor dañado, de otra versión o fuera de rango se ignora y se usan los por defecto.
function parse(raw: string | null): TravelAssumptions | null {
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.v !== VERSION) return null;
  if (typeof d.detour !== 'number' || !Number.isFinite(d.detour) || d.detour < 1) return null;
  if (typeof d.kmh !== 'number' || !Number.isFinite(d.kmh) || d.kmh <= 0) return null;
  if (d.mode !== 'none' && d.mode !== 'fare' && d.mode !== 'perKm') return null;
  if (d.fareCop !== undefined && !isAmount(d.fareCop)) return null;
  if (d.perKmCop !== undefined && !isAmount(d.perKmCop)) return null;
  const out: TravelAssumptions = { detour: d.detour, kmh: d.kmh, mode: d.mode };
  if (d.fareCop !== undefined) out.fareCop = d.fareCop;
  if (d.perKmCop !== undefined) out.perKmCop = d.perKmCop;
  return out;
}

// El rodeo y la velocidad son fijos (ya no se piden): lo que quedó guardado de antes se ignora.
export const readAssumptions = (): TravelAssumptions => {
  const saved = parse(readStored(KEY));
  return saved
    ? { ...saved, detour: DEFAULT_ASSUMPTIONS.detour, kmh: DEFAULT_ASSUMPTIONS.kmh }
    : DEFAULT_ASSUMPTIONS;
};

export const saveAssumptions = (a: TravelAssumptions) => {
  writeStored(KEY, JSON.stringify({ v: VERSION, ...a }));
};
