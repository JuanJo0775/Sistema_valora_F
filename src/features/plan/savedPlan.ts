import type { components } from '../../shared/api/schema';
import { readStored } from '../../shared/storage';
import type { TravelAssumptions } from './travel';

// Planes guardados en este teléfono (esquema v1, diseño §3.4). Nunca se guardan las coordenadas de
// la persona ni distanceM (EC-08): con varias distancias a tiendas conocidas se podría triangular
// su casa. Las coordenadas que sí van son las de la TIENDA, que es dato público.
const KEY = 'valora:planes';
const VERSION = 1;
// Una sola ranura donde se copia lo que no se pudo leer antes de reescribir la clave.
const BACKUP_KEY = 'valora:planes-respaldo';
export const MAX_PLANS = 5;

type Municipality = components['schemas']['Municipality'];
type StoreType = components['schemas']['Establishment']['type'];
type Source = components['schemas']['ComparisonItem']['source'];
type Freshness = components['schemas']['ComparisonItem']['freshness'];

export type SavedArea =
  { kind: 'municipio'; municipality: Municipality } | { kind: 'ubicacion'; radiusKm: number };

export interface SavedStore {
  id: string;
  name: string;
  type: StoreType;
  address?: string;
  lat: number;
  lng: number;
  municipality: Municipality;
  // Tarifa escrita por la persona; null si no pidió domicilio.
  delivery: { feeCop: number } | null;
}

export interface SavedLine {
  productId: string;
  productName: string;
  presentationId: string;
  presentationLabel: string;
  quantity: number;
  // null: ninguna tienda del plan tiene precio vigente para esta presentación.
  storeId: string | null;
  priceCop: number | null;
  source: Source;
  freshness: Freshness;
  // null cuando no hay precio.
  observedAt: string | null;
  bought: boolean;
}

export interface SavedSummary {
  stores: number;
  productsCop: number;
  // Total en la mejor tienda única; null si ninguna tiene todo.
  baselineCop: number | null;
  travel: {
    // Siempre no negativo. extra: es lo que suma dividir frente a ir a una sola tienda (con less,
    // lo que resta); si no, es el total del viaje. Planes v1 anteriores no traen el campo = false.
    extraKm: number;
    extra: boolean;
    less?: boolean;
    minutes: number;
    costCop: number | null;
    assumptions: TravelAssumptions;
  } | null;
  deliveryCop: number;
  netCop: number | null;
  // Productos de la canasta sin precio vigente en el área.
  missing: number;
}

export interface SavedPlan {
  v: 1;
  id: string;
  savedAt: string;
  area: SavedArea;
  stores: SavedStore[];
  lines: SavedLine[];
  summary: SavedSummary;
}

// Lo que la pantalla le pasa a toSavedPlan. Es más ancho que lo guardado a propósito: puede traer
// distanceM en las tiendas o coordenadas en el área, y toSavedPlan las descarta copiando campo a campo.
export interface PlanDraft {
  // En memoria puede llevar lat/lng de la persona; no se guardan.
  area: SavedArea & { lat?: number; lng?: number };
  // Solo las tiendas del plan (las que tienen al menos una línea), con la tarifa de domicilio de cada una.
  stores: (Omit<SavedStore, 'delivery'> & {
    distanceM?: number;
    delivery: SavedStore['delivery'];
  })[];
  // Una línea por producto de la canasta, con su asignación (storeId/priceCop null si no hay precio).
  lines: Omit<SavedLine, 'bought'>[];
  summary: SavedSummary;
}

export function toSavedPlan(draft: PlanDraft, now: Date): SavedPlan {
  const area: SavedArea =
    draft.area.kind === 'municipio'
      ? { kind: 'municipio', municipality: draft.area.municipality }
      : { kind: 'ubicacion', radiusKm: draft.area.radiusKm };
  const stores = draft.stores.map((s): SavedStore => {
    const store: SavedStore = {
      id: s.id,
      name: s.name,
      type: s.type,
      lat: s.lat,
      lng: s.lng,
      municipality: s.municipality,
      delivery: s.delivery === null ? null : { feeCop: s.delivery.feeCop },
    };
    if (s.address !== undefined) store.address = s.address;
    return store;
  });
  const lines = draft.lines.map((l): SavedLine => ({
    productId: l.productId,
    productName: l.productName,
    presentationId: l.presentationId,
    presentationLabel: l.presentationLabel,
    quantity: l.quantity,
    storeId: l.storeId,
    priceCop: l.priceCop,
    source: l.source,
    freshness: l.freshness,
    observedAt: l.observedAt,
    bought: false,
  }));
  const { summary: s } = draft;
  return {
    v: VERSION,
    id: crypto.randomUUID(),
    savedAt: now.toISOString(),
    area,
    stores,
    lines,
    summary: {
      stores: s.stores,
      productsCop: s.productsCop,
      baselineCop: s.baselineCop,
      travel:
        s.travel === null
          ? null
          : {
              extraKm: s.travel.extraKm,
              extra: s.travel.extra,
              ...(s.travel.less === true ? { less: true } : {}),
              minutes: s.travel.minutes,
              costCop: s.travel.costCop,
              assumptions: { ...s.travel.assumptions },
            },
      deliveryCop: s.deliveryCop,
      netCop: s.netCop,
      missing: s.missing,
    },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isNumOrNull = (x: unknown) => x === null || isNum(x);

const validArea = (a: unknown) =>
  isObj(a) &&
  ((a.kind === 'municipio' && isStr(a.municipality)) ||
    (a.kind === 'ubicacion' && isNum(a.radiusKm)));

const validStore = (s: unknown) =>
  isObj(s) &&
  isStr(s.id) &&
  isStr(s.name) &&
  isStr(s.type) &&
  (s.address === undefined || isStr(s.address)) &&
  isNum(s.lat) &&
  isNum(s.lng) &&
  isStr(s.municipality) &&
  (s.delivery === null || (isObj(s.delivery) && isNum(s.delivery.feeCop)));

const validLine = (l: unknown) =>
  isObj(l) &&
  isStr(l.productId) &&
  isStr(l.productName) &&
  isStr(l.presentationId) &&
  isStr(l.presentationLabel) &&
  isNum(l.quantity) &&
  (l.storeId === null || isStr(l.storeId)) &&
  isNumOrNull(l.priceCop) &&
  isStr(l.source) &&
  isStr(l.freshness) &&
  (l.observedAt === null || isStr(l.observedAt)) &&
  typeof l.bought === 'boolean';

const validSummary = (s: unknown) =>
  isObj(s) &&
  isNum(s.stores) &&
  isNum(s.productsCop) &&
  isNumOrNull(s.baselineCop) &&
  (s.travel === null ||
    (isObj(s.travel) &&
      isNum(s.travel.extraKm) &&
      (s.travel.extra === undefined || typeof s.travel.extra === 'boolean') &&
      (s.travel.less === undefined || typeof s.travel.less === 'boolean') &&
      isNum(s.travel.minutes) &&
      isNumOrNull(s.travel.costCop) &&
      isObj(s.travel.assumptions))) &&
  isNum(s.deliveryCop) &&
  isNumOrNull(s.netCop) &&
  isNum(s.missing);

const validPlan = (p: unknown): p is SavedPlan =>
  isObj(p) &&
  p.v === VERSION &&
  isStr(p.id) &&
  isStr(p.savedAt) &&
  validArea(p.area) &&
  Array.isArray(p.stores) &&
  p.stores.every(validStore) &&
  Array.isArray(p.lines) &&
  p.lines.every(validLine) &&
  validSummary(p.summary);

// Pura: del valor leído (ya sin JSON.parse) a los planes de la versión actual. Un valor dañado o
// de versión desconocida da []; un plan inválido se descarta sin arrastrar a los demás.
export function migrate(raw: unknown): SavedPlan[] {
  if (!isObj(raw) || raw.v !== VERSION || !Array.isArray(raw.plans)) return [];
  const plans: unknown[] = raw.plans;
  return plans.filter(validPlan).map((p) => {
    const plan = structuredClone(p);
    // Planes v1 sin el campo: el número era el que se guardaba, sin saber si era extra.
    if (plan.summary.travel && typeof plan.summary.travel.extra !== 'boolean')
      plan.summary.travel.extra = false;
    return plan;
  });
}

// Lo leído de valora:planes y, si no se pudo leer entero como v1, el texto original (para respaldarlo).
interface Stored {
  plans: SavedPlan[];
  unreadable: string | null;
}

function readStoredPlans(): Stored {
  const raw = readStored(KEY);
  if (raw === null) return { plans: [], unreadable: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    const plans = migrate(parsed);
    const count =
      isObj(parsed) && parsed.v === VERSION && Array.isArray(parsed.plans)
        ? parsed.plans.length
        : -1;
    // Versión desconocida, forma inválida o planes descartados: al escribir se perderían.
    return { plans, unreadable: count === plans.length ? null : raw };
  } catch {
    return { plans: [], unreadable: raw };
  }
}

export function readPlans(): SavedPlan[] {
  return readStoredPlans().plans;
}

// A diferencia de writeStored, aquí hay que saber si de verdad se guardó.
function setItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

// Antes de pisar un valor ilegible, copia su texto a una sola ranura de respaldo (no la pisa).
// Si no se puede respaldar, no se escribe: mejor no guardar que perder lo que había.
function write({ unreadable }: Stored, next: SavedPlan[]): boolean {
  if (unreadable !== null) {
    let hasBackup: boolean;
    try {
      hasBackup = localStorage.getItem(BACKUP_KEY) !== null;
    } catch {
      return false;
    }
    if (!hasBackup && !setItem(BACKUP_KEY, unreadable)) return false;
  }
  return setItem(KEY, JSON.stringify({ v: VERSION, plans: next }));
}

export function savePlan(plan: SavedPlan): 'saved' | 'full' | 'failed' {
  const state = readStoredPlans();
  const plans = [...state.plans];
  const i = plans.findIndex((p) => p.id === plan.id);
  if (i >= 0) plans[i] = plan;
  else if (plans.length >= MAX_PLANS) return 'full';
  else plans.push(plan);
  return write(state, plans) ? 'saved' : 'failed';
}

export function deletePlan(id: string): void {
  const state = readStoredPlans();
  if (state.plans.some((p) => p.id === id)) {
    write(
      state,
      state.plans.filter((p) => p.id !== id),
    );
  }
}

export function toggleBought(id: string, presentationId: string): void {
  const state = readStoredPlans();
  const plan = state.plans.find((p) => p.id === id);
  if (!plan) return;
  plan.lines = plan.lines.map((l) =>
    l.presentationId === presentationId ? { ...l, bought: !l.bought } : l,
  );
  write(state, state.plans);
}
