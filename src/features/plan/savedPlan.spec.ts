import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPriceUpdate,
  defaultListName,
  deletePlan,
  diffPrices,
  duplicatePlan,
  MAX_PLANS,
  planName,
  renamePlan,
  type PriceOffer,
  migrate,
  readPlans,
  savePlan,
  savePlanOnce,
  toggleBought,
  toSavedPlan,
  type PlanDraft,
  type SavedPlan,
} from './savedPlan';
import { planDraft } from '../../test/planFixtures';

const KEY = 'valora:planes';
const NOW = new Date('2026-11-17T15:04:00Z');

// Coordenadas de la persona: nunca deben aparecer en lo guardado.
const USER = { lat: 4.5339, lng: -75.6811 };

const draft = (): PlanDraft => planDraft();

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

  it('el plan 21 devuelve full y no se guarda', () => {
    expect(MAX_PLANS).toBe(20);
    for (let i = 0; i < 20; i++) expect(savePlan(make(`id-${String(i)}`))).toBe('saved');
    expect(savePlan(make('id-20'))).toBe('full');
    expect(readPlans()).toHaveLength(20);
  });

  it('volver a guardar un plan existente lo reemplaza aun con 20 planes', () => {
    for (let i = 0; i < 20; i++) savePlan(make(`id-${String(i)}`));
    expect(savePlan({ ...make('id-2'), savedAt: '2026-11-18T00:00:00.000Z' })).toBe('saved');
    expect(readPlans()).toHaveLength(20);
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

describe('supuestos guardados inválidos', () => {
  const withAssumptions = (assumptions: unknown) => {
    const plan = structuredClone(make('a')) as unknown as {
      summary: { travel: { assumptions: unknown } };
    };
    plan.summary.travel.assumptions = assumptions;
    return { v: 1, plans: [plan] };
  };

  it('acepta los supuestos con números y modo válidos', () => {
    expect(
      migrate(withAssumptions({ detour: 1.3, kmh: 4.5, mode: 'fare', fareCop: 2500 })),
    ).toHaveLength(1);
  });

  it.each([
    ['rodeo de texto', { detour: '1.3', kmh: 4.5, mode: 'none' }],
    ['velocidad ausente', { detour: 1.3, mode: 'none' }],
    ['modo desconocido', { detour: 1.3, kmh: 4.5, mode: 'taxi' }],
    ['pasaje de texto', { detour: 1.3, kmh: 4.5, mode: 'fare', fareCop: 'mucho' }],
    ['costo por km de texto', { detour: 1.3, kmh: 4.5, mode: 'perKm', perKmCop: {} }],
    ['velocidad 0 (dividiría por cero)', { detour: 1.3, kmh: 0, mode: 'none' }],
  ])('descarta el plan con %s', (_name, assumptions) => {
    expect(migrate(withAssumptions(assumptions))).toEqual([]);
  });
});

describe('guardar sin repetir', () => {
  it('un plan nuevo se guarda; el mismo contenido solo refresca savedAt y no gasta cupo', () => {
    const first = make('a');
    expect(savePlanOnce(first)).toEqual({ outcome: 'saved', id: 'a' });
    toggleBought('a', 'pr1');
    const again = { ...make('b'), savedAt: '2026-11-20T10:00:00.000Z' };
    expect(savePlanOnce(again)).toEqual({ outcome: 'same', id: 'a' });
    const plans = readPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0]?.savedAt).toBe('2026-11-20T10:00:00.000Z');
    expect(plans[0]?.lines[0]?.bought).toBe(true);
  });

  it('con otro precio, otra cantidad o otra área es un plan distinto', () => {
    savePlanOnce(make('a'));
    const price = make('b');
    price.lines[0] = { ...price.lines[0], priceCop: 1 } as SavedPlan['lines'][number];
    const qty = make('c');
    qty.lines[0] = { ...qty.lines[0], quantity: 9 } as SavedPlan['lines'][number];
    const area = { ...make('d'), area: { kind: 'municipio', municipality: 'armenia' } as const };
    for (const plan of [price, qty, area]) expect(savePlanOnce(plan).outcome).toBe('saved');
    expect(readPlans().map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('con el cupo lleno, un plan igual a uno guardado se refresca en vez de dar full', () => {
    for (let i = 0; i < 19; i++)
      savePlan({ ...make(`id-${String(i)}`), area: { kind: 'ubicacion', radiusKm: i + 10 } });
    savePlan(make('e'));
    expect(savePlanOnce(make('z')).outcome).toBe('same');
    expect(savePlanOnce({ ...make('y'), area: { kind: 'ubicacion', radiusKm: 5.5 } }).outcome).toBe(
      'full',
    );
  });
});

describe('comparar y aplicar precios nuevos', () => {
  // make('a'): arroz pr1 en s1 a 2190 (×2), aceite pr2 en s2 a 9000, sal sin precio.
  const at = (
    storeId: string,
    presentationId: string,
    priceCop: number,
    day = '2026-11-19',
  ): PriceOffer => ({
    establishment: {
      id: storeId,
      name: storeId === 's1' ? 'D1 Calle 50' : storeId === 's2' ? 'Tienda Don Pepe' : 'Otra',
    },
    presentationId,
    priceCop,
    source: 'oficial',
    freshness: 'vigente',
    observedAt: `${day}T15:00:00Z`,
  });
  const byProduct = (...offers: [string, PriceOffer[]][]) => new Map(offers);
  const diff = (offers: Map<string, PriceOffer[]>) => diffPrices(make('a'), offers);

  it('solo compara las líneas con tienda y precio, en la misma tienda y presentación', () => {
    const result = diff(
      byProduct(
        ['p1', [at('s1', 'pr1', 2190), at('s1', 'otra-presentacion', 1)]],
        ['p2', [at('s2', 'pr2', 9000)]],
      ),
    );
    expect(result.map((d) => [d.productId, d.kind])).toEqual([
      ['p1', 'same'],
      ['p2', 'same'],
    ]);
  });

  it('precio que subió o bajó, con lo de antes y lo de ahora', () => {
    const [up, down] = diff(
      byProduct(['p1', [at('s1', 'pr1', 2350)]], ['p2', [at('s2', 'pr2', 8500)]]),
    );
    expect(up).toMatchObject({
      kind: 'up',
      storeName: 'D1 Calle 50',
      beforeCop: 2190,
      beforeAt: '2026-11-16T15:00:00Z',
      now: {
        priceCop: 2350,
        observedAt: '2026-11-19T15:00:00Z',
        source: 'oficial',
        freshness: 'vigente',
      },
    });
    expect(down?.kind).toBe('down');
  });

  it('con varias ofertas en la misma tienda toma la más barata', () => {
    const [d] = diff(byProduct(['p1', [at('s1', 'pr1', 3000), at('s1', 'pr1', 2400)]]));
    expect(d?.now?.priceCop).toBe(2400);
  });

  it('sin oferta vigente en esa tienda: gone, y avisa si otra tienda es más barata que antes', () => {
    const [gone, other] = diff(
      byProduct(['p1', [at('s9', 'pr1', 2000)]], ['p2', [at('s9', 'pr2', 9500)]]),
    );
    expect(gone).toMatchObject({
      kind: 'gone',
      now: null,
      cheaper: { storeName: 'Otra', priceCop: 2000 },
    });
    expect(other).toMatchObject({ kind: 'gone', cheaper: null });
  });

  it('otra tienda más barata que el precio de ahora se anota sin cambiar el reparto', () => {
    const [d] = diff(
      byProduct(['p1', [at('s1', 'pr1', 2350), at('s9', 'pr1', 2100), at('s8', 'pr1', 2200)]]),
    );
    expect(d?.cheaper).toEqual({ storeName: 'Otra', priceCop: 2100 });
    expect(
      diff(byProduct(['p1', [at('s1', 'pr1', 2350), at('s9', 'pr1', 2350)]]))[0]?.cheaper,
    ).toBeNull();
  });

  it('un producto que no vino en la respuesta cuenta como sin precio vigente', () => {
    expect(diff(new Map())[0]?.kind).toBe('gone');
  });

  it('applyPriceUpdate cambia solo las líneas con otro precio y recalcula productsCop', () => {
    const plan = make('a');
    const next = applyPriceUpdate(
      plan,
      diff(byProduct(['p1', [at('s1', 'pr1', 2350)]], ['p2', []])),
    );
    expect(next.lines[0]).toMatchObject({
      priceCop: 2350,
      observedAt: '2026-11-19T15:00:00Z',
      source: 'oficial',
      freshness: 'vigente',
      storeId: 's1',
      bought: false,
    });
    // La línea que ya no tiene precio vigente no se toca.
    expect(next.lines[1]).toEqual(plan.lines[1]);
    expect(next.lines[2]).toEqual(plan.lines[2]);
    expect(next.summary.productsCop).toBe(2350 * 2 + 9000);
    expect(next.summary.baselineCop).toBeNull();
    expect(next.summary.netCop).toBeNull();
    expect(next.summary.pricesUpdatedAt).toBeDefined();
    expect(next.stores).toEqual(plan.stores);
    expect(next.summary.travel).toEqual(plan.summary.travel);
    expect(next.summary.deliveryCop).toBe(plan.summary.deliveryCop);
    expect(plan.summary.baselineCop).toBe(15000);
    expect(migrate({ v: 1, plans: [next] })).toHaveLength(1);
  });

  it('sin cambios de precio devuelve el mismo plan', () => {
    const plan = make('a');
    expect(applyPriceUpdate(plan, diff(byProduct(['p1', [at('s1', 'pr1', 2190)]])))).toBe(plan);
  });
});

describe('listas guardadas (un plan con nombre)', () => {
  const bare = (): PlanDraft => ({
    area: { kind: 'municipio', municipality: 'armenia' },
    stores: [],
    lines: draft().lines.map((l) => ({ ...l, storeId: null, priceCop: null, observedAt: null })),
    summary: {
      stores: 0,
      productsCop: 0,
      baselineCop: null,
      travel: null,
      deliveryCop: 0,
      netCop: null,
      missing: 3,
    },
  });

  it('defaultListName usa el día de Colombia', () => {
    expect(defaultListName('2026-11-22T03:30:00Z')).toBe('Lista del 21 nov');
    expect(defaultListName('no es fecha')).toBe('Lista de compras');
  });

  it('planName: el nombre, o «Plan del <fecha>» si el plan es anterior', () => {
    expect(planName(toSavedPlan(draft(), NOW))).toBe('Plan del 17 nov');
    expect(planName(toSavedPlan(draft(), NOW, 'Mercado semanal'))).toBe('Mercado semanal');
    expect(planName({ ...make('x'), savedAt: 'nada' })).toBe('Plan guardado');
  });

  it('toSavedPlan guarda listName; sin él, el campo no existe', () => {
    expect(toSavedPlan(draft(), NOW, 'Mercado semanal').listName).toBe('Mercado semanal');
    expect('listName' in toSavedPlan(draft(), NOW)).toBe(false);
    expect(toSavedPlan(draft(), NOW, '   ').listName).toBeUndefined();
  });

  it('el nombre sobrevive a guardar y leer, y el JSON sigue sin distanceM ni coordenadas', () => {
    savePlan(toSavedPlan(draft(), NOW, 'Mercado semanal'));
    const raw = localStorage.getItem(KEY) ?? '';
    expect(readPlans()[0]?.listName).toBe('Mercado semanal');
    expect(raw).not.toContain('distanceM');
    expect(raw).not.toContain(String(USER.lat));
    expect(raw).not.toContain(String(USER.lng));
  });

  it('los planes viejos sin listName se leen igual', () => {
    const old = make('viejo');
    localStorage.setItem(KEY, JSON.stringify({ v: 1, plans: [old] }));
    expect(readPlans()).toEqual([old]);
  });

  it('un listName que no es texto se quita sin perder el plan', () => {
    const odd = { ...make('raro'), listName: 7 };
    const [plan] = migrate({ v: 1, plans: [odd] });
    expect(plan?.id).toBe('raro');
    expect(plan && 'listName' in plan).toBe(false);
  });

  it('una lista sin precios ni tiendas es válida y se guarda', () => {
    const plan = toSavedPlan(bare(), NOW, 'Solo la lista');
    expect(savePlan(plan)).toBe('saved');
    const [read] = readPlans();
    expect(read?.stores).toEqual([]);
    expect(read?.lines.every((l) => l.storeId === null && l.priceCop === null)).toBe(true);
  });

  it('savePlanOnce con el mismo contenido no gasta cupo y adopta el nombre nuevo', () => {
    savePlan(toSavedPlan(draft(), NOW, 'Uno'));
    const { outcome } = savePlanOnce(toSavedPlan(draft(), NOW, 'Dos'));
    expect(outcome).toBe('same');
    expect(readPlans()).toHaveLength(1);
    expect(readPlans()[0]?.listName).toBe('Dos');
    savePlanOnce(toSavedPlan(draft(), NOW));
    expect(readPlans()[0]?.listName).toBe('Dos');
  });

  it('renamePlan recorta, limita a 60 y, vacío, vuelve al nombre por defecto', () => {
    savePlan(make('a'));
    expect(renamePlan('a', '  Mercado  ')).toBe(true);
    expect(readPlans()[0]?.listName).toBe('Mercado');
    renamePlan('a', 'x'.repeat(80));
    expect(readPlans()[0]?.listName).toHaveLength(60);
    renamePlan('a', '   ');
    expect(readPlans()[0]?.listName).toBe('Lista del 17 nov');
    expect(renamePlan('nadie', 'Algo')).toBe(false);
  });

  it('renamePlan devuelve false si no se puede escribir', () => {
    savePlan(make('a'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cuota', 'QuotaExceededError');
    });
    expect(renamePlan('a', 'Otro')).toBe(false);
  });

  it('duplicatePlan crea otro id y otra fecha, con «(copia)» y sin lo comprado', () => {
    const original = toSavedPlan(draft(), NOW, 'Mercado semanal');
    original.lines[0] = { ...original.lines[0], bought: true } as SavedPlan['lines'][number];
    savePlan(original);
    const later = new Date('2026-11-20T10:00:00Z');
    const result = duplicatePlan(original.id, later);
    expect(result.outcome).toBe('saved');
    const plans = readPlans();
    expect(plans).toHaveLength(2);
    const copy = plans.find((p) => p.id === result.id);
    expect(copy?.id).not.toBe(original.id);
    expect(copy?.savedAt).toBe(later.toISOString());
    expect(copy?.listName).toBe('Mercado semanal (copia)');
    expect(copy?.lines.every((l) => !l.bought)).toBe(true);
  });

  it('duplicar un plan viejo parte de «Plan del <fecha>» y el nombre cabe en 60', () => {
    savePlan(make('a'));
    duplicatePlan('a');
    expect(readPlans()[1]?.listName).toBe('Plan del 17 nov (copia)');
    savePlan({ ...make('b'), listName: 'y'.repeat(60) });
    duplicatePlan('b');
    const long = readPlans().at(-1)?.listName ?? '';
    expect(long).toHaveLength(60);
    expect(long.endsWith(' (copia)')).toBe(true);
  });

  it('duplicatePlan respeta el límite, el plan que falta y la escritura', () => {
    for (let i = 0; i < 20; i++) savePlan(make(`id-${String(i)}`));
    expect(duplicatePlan('id-1').outcome).toBe('full');
    expect(duplicatePlan('nadie').outcome).toBe('missing');
    deletePlan('id-0');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cuota', 'QuotaExceededError');
    });
    expect(duplicatePlan('id-1').outcome).toBe('failed');
  });
});
