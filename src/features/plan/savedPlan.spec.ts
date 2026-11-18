import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deletePlan,
  migrate,
  readPlans,
  savePlan,
  toggleBought,
  toSavedPlan,
  type PlanDraft,
  type SavedPlan,
} from './savedPlan';

const KEY = 'valora:planes';
const NOW = new Date('2026-11-17T15:04:00Z');

// Coordenadas de la persona: nunca deben aparecer en lo guardado.
const USER = { lat: 4.5339, lng: -75.6811 };

const draft = (): PlanDraft => ({
  area: { kind: 'ubicacion', radiusKm: 1.5, ...USER },
  stores: [
    {
      id: 's1',
      name: 'D1 Calle 50',
      type: 'descuento',
      address: 'Cl. 50 # 14-20',
      lat: 4.53,
      lng: -75.68,
      municipality: 'armenia',
      distanceM: 812,
      delivery: { feeCop: 5000 },
    },
    {
      id: 's2',
      name: 'Tienda Don Pepe',
      type: 'barrio',
      lat: 4.54,
      lng: -75.69,
      municipality: 'armenia',
      distanceM: 400,
      delivery: null,
    },
  ],
  lines: [
    {
      productId: 'p1',
      productName: 'Arroz blanco',
      presentationId: 'pr1',
      presentationLabel: 'Diana · 500 g',
      quantity: 2,
      storeId: 's1',
      priceCop: 2190,
      source: 'siembra',
      freshness: 'vigente',
      observedAt: '2026-11-16T10:00:00Z',
    },
    {
      productId: 'p2',
      productName: 'Aceite',
      presentationId: 'pr2',
      presentationLabel: '1 L',
      quantity: 1,
      storeId: 's2',
      priceCop: 9000,
      source: 'comunidad',
      freshness: 'vigente',
      observedAt: '2026-11-15T10:00:00Z',
    },
    {
      productId: 'p3',
      productName: 'Sal',
      presentationId: 'pr3',
      presentationLabel: '500 g',
      quantity: 1,
      storeId: null,
      priceCop: null,
      source: 'comunidad',
      freshness: 'vigente',
      observedAt: null,
    },
  ],
  summary: {
    stores: 2,
    productsCop: 13380,
    baselineCop: 15000,
    travel: {
      extraKm: 1.4,
      extra: true,
      minutes: 19,
      costCop: null,
      assumptions: { detour: 1.3, kmh: 4.5, mode: 'none' },
    },
    deliveryCop: 5000,
    netCop: -3380,
    missing: 1,
  },
});

const make = (id: string): SavedPlan => ({ ...toSavedPlan(draft(), NOW), id });

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('toSavedPlan', () => {
  it('no incluye distanceM ni coordenadas de la consulta ni lat/lng fuera de stores[]', () => {
    const plan = toSavedPlan(draft(), NOW);
    const json = JSON.stringify(plan);
    expect(json).not.toContain('distanceM');
    expect(json).not.toContain(String(USER.lat));
    expect(json).not.toContain(String(USER.lng));
    expect(plan.area).toEqual({ kind: 'ubicacion', radiusKm: 1.5 });
    const { stores, ...rest } = plan;
    expect(JSON.stringify(rest)).not.toMatch(/"(lat|lng)"/);
    expect(stores[0]).toMatchObject({ lat: 4.53, lng: -75.68, delivery: { feeCop: 5000 } });
  });

  it('pone v, id y savedAt, y arranca con todo sin comprar', () => {
    const plan = toSavedPlan(draft(), NOW);
    expect(plan.v).toBe(1);
    expect(plan.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(plan.savedAt).toBe('2026-11-17T15:04:00.000Z');
    expect(plan.lines.every((l) => !l.bought)).toBe(true);
  });

  it('un área por municipio no lleva radio', () => {
    const d = draft();
    d.area = { kind: 'municipio', municipality: 'armenia' };
    expect(toSavedPlan(d, NOW).area).toEqual({ kind: 'municipio', municipality: 'armenia' });
  });
});

describe('guardar y leer', () => {
  it('guarda y lee lo mismo', () => {
    const plan = toSavedPlan(draft(), NOW);
    expect(savePlan(plan)).toBe('saved');
    expect(readPlans()).toEqual([plan]);
    expect((JSON.parse(localStorage.getItem(KEY) ?? '{}') as { v: number }).v).toBe(1);
  });

  it('el sexto plan devuelve full y no se guarda', () => {
    for (let i = 0; i < 5; i++) expect(savePlan(make(`id-${String(i)}`))).toBe('saved');
    expect(savePlan(make('id-5'))).toBe('full');
    expect(readPlans()).toHaveLength(5);
  });

  it('volver a guardar un plan existente lo reemplaza aun con 5 planes', () => {
    for (let i = 0; i < 5; i++) savePlan(make(`id-${String(i)}`));
    expect(savePlan({ ...make('id-2'), savedAt: '2026-11-18T00:00:00.000Z' })).toBe('saved');
    expect(readPlans()).toHaveLength(5);
    expect(readPlans().find((p) => p.id === 'id-2')?.savedAt).toBe('2026-11-18T00:00:00.000Z');
  });

  it('setItem que lanza devuelve failed sin romper', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cuota', 'QuotaExceededError');
    });
    expect(savePlan(make('a'))).toBe('failed');
    expect(() => {
      toggleBought('a', 'pr1');
      deletePlan('a');
    }).not.toThrow();
  });

  it('getItem que lanza se lee como sin planes', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(readPlans()).toEqual([]);
  });
});

describe('valores dañados (Review Focus 3)', () => {
  it.each([
    ['JSON corrupto', '{no es json'],
    ['otra versión', JSON.stringify({ v: 2, plans: [make('a')] })],
    ['forma inválida', JSON.stringify({ v: 1, plans: 'nada' })],
    ['sin objeto', JSON.stringify([1, 2])],
    ['plan con líneas inválidas', JSON.stringify({ v: 1, plans: [{ ...make('a'), lines: 'x' }] })],
  ])('%s se ignora', (_nombre, raw) => {
    localStorage.setItem(KEY, raw);
    expect(readPlans()).toEqual([]);
  });

  it('un plan inválido no arrastra a los válidos', () => {
    const raw: unknown = { v: 1, plans: [{ id: 3 }, make('ok')] };
    expect(migrate(raw).map((p) => p.id)).toEqual(['ok']);
  });
});

describe('migrate', () => {
  it('es pura: no muta la entrada y devuelve lo mismo cada vez', () => {
    const raw = { v: 1, plans: [make('a')] };
    const copy = JSON.stringify(raw);
    const first = migrate(raw);
    expect(JSON.stringify(raw)).toBe(copy);
    expect(migrate(raw)).toEqual(first);
    expect(first[0]).not.toBe(raw.plans[0]);
  });

  it('devuelve [] con basura', () => {
    expect(migrate(null)).toEqual([]);
    expect(migrate(undefined)).toEqual([]);
    expect(migrate(7)).toEqual([]);
  });
});

const BACKUP = 'valora:planes-respaldo';
const UNREADABLE: [string, string][] = [
  ['de versión 2', JSON.stringify({ v: 2, plans: [make('futuro')] })],
  ['JSON roto', '{no es json'],
  ['de forma inválida', JSON.stringify({ v: 1, plans: 'nada' })],
];

describe('no pisar lo que no se pudo leer (§3.4)', () => {
  it.each(UNREADABLE)('savePlan con un valor %s lo respalda antes de escribir', (_n, raw) => {
    localStorage.setItem(KEY, raw);
    expect(savePlan(make('nuevo'))).toBe('saved');
    expect(localStorage.getItem(BACKUP)).toBe(raw);
    expect(readPlans().map((p) => p.id)).toEqual(['nuevo']);
  });

  it('con un valor v1 legible no crea respaldo', () => {
    savePlan(make('a'));
    savePlan(make('b'));
    toggleBought('a', 'pr1');
    deletePlan('b');
    expect(localStorage.getItem(BACKUP)).toBeNull();
  });

  it('si ya hay respaldo no lo pisa', () => {
    localStorage.setItem(BACKUP, 'primero');
    localStorage.setItem(KEY, '{roto');
    savePlan(make('nuevo'));
    expect(localStorage.getItem(BACKUP)).toBe('primero');
  });

  it('si no puede respaldar, no escribe', () => {
    const raw = JSON.stringify({ v: 2, plans: [] });
    localStorage.setItem(KEY, raw);
    const set = Storage.prototype.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => {
      if (k === BACKUP) throw new DOMException('cuota', 'QuotaExceededError');
      set(k, v);
    });
    expect(savePlan(make('nuevo'))).toBe('failed');
    expect(localStorage.getItem(KEY)).toBe(raw);
  });

  it.each(UNREADABLE)('deletePlan y toggleBought no destruyen un valor %s', (_n, raw) => {
    localStorage.setItem(KEY, raw);
    deletePlan('futuro');
    toggleBought('futuro', 'pr1');
    expect(localStorage.getItem(KEY)).toBe(raw);
  });

  it('si solo algunos planes son inválidos, respalda antes de que se pierdan al escribir', () => {
    const raw = JSON.stringify({ v: 1, plans: [{ id: 3 }, make('ok')] });
    localStorage.setItem(KEY, raw);
    savePlan(make('nuevo'));
    expect(localStorage.getItem(BACKUP)).toBe(raw);
    expect(readPlans().map((p) => p.id)).toEqual(['ok', 'nuevo']);
  });
});

describe('traslado de planes v1 anteriores', () => {
  it('sin el campo extra se lee como extra: false', () => {
    const base = make('a');
    const travel = { ...(base.summary.travel as NonNullable<SavedPlan['summary']['travel']>) };
    Reflect.deleteProperty(travel, 'extra');
    const old = { ...base, summary: { ...base.summary, travel } };
    const [plan] = migrate({ v: 1, plans: [old] });
    expect(plan?.summary.travel?.extra).toBe(false);
  });

  it('un extra que no es booleano invalida el plan', () => {
    const bad = make('a');
    (bad.summary.travel as unknown as { extra: unknown }).extra = 'si';
    expect(migrate({ v: 1, plans: [bad] })).toEqual([]);
  });
});

describe('toggleBought y deletePlan', () => {
  it('toggleBought cambia solo esa línea de ese plan', () => {
    savePlan(make('a'));
    savePlan(make('b'));
    toggleBought('a', 'pr1');
    const [a, b] = readPlans();
    expect(a?.lines.map((l) => l.bought)).toEqual([true, false, false]);
    expect(b?.lines.every((l) => !l.bought)).toBe(true);
    toggleBought('a', 'pr1');
    expect(readPlans()[0]?.lines[0]?.bought).toBe(false);
  });

  it('toggleBought con id inexistente no cambia nada', () => {
    savePlan(make('a'));
    toggleBought('zzz', 'pr1');
    expect(readPlans()[0]?.lines.every((l) => !l.bought)).toBe(true);
  });

  it('deletePlan borra solo ese plan', () => {
    savePlan(make('a'));
    savePlan(make('b'));
    deletePlan('a');
    expect(readPlans().map((p) => p.id)).toEqual(['b']);
  });
});
