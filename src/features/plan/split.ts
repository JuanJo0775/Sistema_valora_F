import type { components } from '../../shared/api/schema';
import type { BasketLine } from '../basket/totals';

type Offer = components['schemas']['ComparisonItem'];
type Store = Offer['establishment'];

export interface PlanAssignment {
  presentationId: string;
  quantity: number;
  unitCop: number;
  lineCop: number;
}

export interface StoreShare {
  store: Store;
  lines: PlanAssignment[];
  subtotalCop: number;
  // Cuántas tiendas tienen exactamente los mismos precios (la propia incluida).
  equivalentStores: number;
}

export interface SplitOption {
  stores: 1 | 2 | 3;
  shares: StoreShare[];
  productsCop: number;
  savingsVsBestSingleCop: number | null;
}

export interface SplitResult {
  options: SplitOption[];
  // presentationId sin oferta en el área.
  unpriced: string[];
}

const MAX_CANDIDATES = 15;

// Comparación de textos carácter por carácter, sin depender del idioma del navegador.
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

interface Candidate {
  store: Store;
  // Precio unitario por índice de línea con precio; undefined si la tienda no la tiene.
  prices: (number | undefined)[];
  found: number;
  totalCop: number;
  equivalent: number;
  rank: number;
}

interface Combo {
  members: Candidate[];
  assigned: number[][];
  missing: number;
  productsCop: number;
  distance: number;
}

const distanceOf = (store: Store) => store.distanceM ?? 0;

// Combinaciones de `size` elementos de 0..n-1, en orden lexicográfico.
function* combinations(n: number, size: number): Generator<number[]> {
  const pick: number[] = [];
  function* walk(start: number): Generator<number[]> {
    if (pick.length === size) {
      yield [...pick];
      return;
    }
    for (let i = start; i < n; i += 1) {
      pick.push(i);
      yield* walk(i + 1);
      pick.pop();
    }
  }
  yield* walk(0);
}

// EC-06: solo cuentan presentación exacta, precio, distancia e identificadores. Nada comercial.
export function bestSplits(lines: BasketLine[], maxStores: 1 | 2 | 3): SplitResult {
  // Líneas en un orden propio, para que el resultado no dependa del orden de entrada.
  const sorted = [...lines].sort(
    (a, b) => cmp(a.presentationId, b.presentationId) || a.quantity - b.quantity,
  );

  // (a) Matriz precio por tienda y línea: presentación exacta y, si se repite, el menor precio.
  const stores = new Map<string, { store: Store; prices: Map<number, number> }>();
  const priced: BasketLine[] = [];
  const unpriced: string[] = [];
  for (const line of sorted) {
    const byStore = new Map<string, { store: Store; price: number }>();
    for (const o of line.offers) {
      if (o.presentationId !== line.presentationId) continue;
      const known = byStore.get(o.establishment.id);
      if (!known || o.priceCop < known.price) {
        byStore.set(o.establishment.id, { store: o.establishment, price: o.priceCop });
      }
    }
    if (byStore.size === 0) {
      unpriced.push(line.presentationId);
      continue;
    }
    const index = priced.length;
    priced.push(line);
    for (const [id, { store, price }] of byStore) {
      const entry = stores.get(id) ?? { store, prices: new Map<number, number>() };
      entry.prices.set(index, price);
      stores.set(id, entry);
    }
  }
  if (priced.length === 0) return { options: [], unpriced };

  // (b) Tiendas con el mismo vector de precios: queda la de menor distancia y luego menor id.
  const groups = new Map<string, Candidate[]>();
  for (const { store, prices } of stores.values()) {
    const vector = priced.map((_, i) => prices.get(i));
    const found = vector.filter((p) => p !== undefined).length;
    const totalCop = vector.reduce<number>(
      (sum, p, i) => sum + (p ?? 0) * (priced[i]?.quantity ?? 0),
      0,
    );
    const key = JSON.stringify(vector);
    const group = groups.get(key) ?? [];
    group.push({ store, prices: vector, found, totalCop, equivalent: 0, rank: 0 });
    groups.set(key, group);
  }
  const unique: Candidate[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => distanceOf(a.store) - distanceOf(b.store) || cmp(a.store.id, b.store.id));
    const [first] = group;
    if (first) unique.push({ ...first, equivalent: group.length });
  }
  // Orden individual: más productos con precio, menor total, id. Es el desempate de asignación.
  unique.sort(
    (a, b) => b.found - a.found || a.totalCop - b.totalCop || cmp(a.store.id, b.store.id),
  );
  unique.forEach((c, i) => {
    c.rank = i;
  });

  // (d) y (e) Cada línea va a la tienda más barata de la combinación; todas deben recibir algo.
  const evaluate = (members: Candidate[]): Combo | null => {
    const ordered = [...members].sort((a, b) => a.rank - b.rank);
    const assigned: number[][] = ordered.map(() => []);
    let missing = 0;
    let productsCop = 0;
    for (let line = 0; line < priced.length; line += 1) {
      let best = -1;
      let bestPrice = Infinity;
      ordered.forEach((m, i) => {
        const price = m.prices[line];
        if (price !== undefined && price < bestPrice) {
          best = i;
          bestPrice = price;
        }
      });
      if (best < 0) {
        missing += 1;
        continue;
      }
      assigned[best]?.push(line);
      productsCop += bestPrice * (priced[line]?.quantity ?? 0);
    }
    if (assigned.some((a) => a.length === 0)) return null;
    const distance = ordered.reduce((sum, m) => sum + distanceOf(m.store), 0);
    return { members: ordered, assigned, missing, productsCop, distance };
  };

  const idsOf = (c: Combo) => c.members.map((m) => m.store.id).sort(cmp);
  const better = (a: Combo, b: Combo) => {
    const diff = a.missing - b.missing || a.productsCop - b.productsCop || a.distance - b.distance;
    if (diff !== 0) return diff;
    const ia = idsOf(a);
    const ib = idsOf(b);
    for (let i = 0; i < Math.min(ia.length, ib.length); i += 1) {
      const c = cmp(ia[i] ?? '', ib[i] ?? '');
      if (c !== 0) return c;
    }
    return ia.length - ib.length;
  };

  // (c) k=3 sobre hasta 15 candidatas: las más baratas en alguna línea y, si sobra sitio, las de
  // mejor total individual.
  const pruned = (): Candidate[] => {
    if (unique.length <= MAX_CANDIDATES) return unique;
    const cheapest = new Set<number>();
    for (let line = 0; line < priced.length; line += 1) {
      const min = Math.min(...unique.map((c) => c.prices[line] ?? Infinity));
      unique.forEach((c) => {
        if (c.prices[line] === min) cheapest.add(c.rank);
      });
    }
    const chosen = unique.filter((c) => cheapest.has(c.rank)).slice(0, MAX_CANDIDATES);
    for (const c of unique) {
      if (chosen.length >= MAX_CANDIDATES) break;
      if (!cheapest.has(c.rank)) chosen.push(c);
    }
    return chosen;
  };

  const bestOf = (pool: Candidate[], size: number): Combo | null => {
    let winner: Combo | null = null;
    for (const picked of combinations(pool.length, size)) {
      const combo = evaluate(picked.map((i) => pool[i] as Candidate));
      if (combo && (!winner || better(combo, winner) < 0)) winner = combo;
    }
    return winner;
  };

  // (g) Mejor tienda única que cubre todas las líneas con precio.
  const single = unique.find((c) => c.found === priced.length);

  const options: SplitOption[] = [];
  for (const size of [1, 2, 3] as const) {
    if (size > maxStores) break;
    const combo = bestOf(size === 3 ? pruned() : unique, size);
    if (!combo) continue;
    options.push({
      stores: size,
      productsCop: combo.productsCop,
      savingsVsBestSingleCop: single ? single.totalCop - combo.productsCop : null,
      shares: combo.members.map((m, i) => {
        const assignments = (combo.assigned[i] ?? []).map((line): PlanAssignment => {
          const unitCop = m.prices[line] ?? 0;
          const quantity = priced[line]?.quantity ?? 0;
          return {
            presentationId: priced[line]?.presentationId ?? '',
            quantity,
            unitCop,
            lineCop: unitCop * quantity,
          };
        });
        return {
          store: m.store,
          lines: assignments,
          subtotalCop: assignments.reduce((sum, a) => sum + a.lineCop, 0),
          equivalentStores: m.equivalent,
        };
      }),
    });
  }
  return { options, unpriced };
}
