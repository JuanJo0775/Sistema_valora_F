import { describe, expect, it } from 'vitest';
import type { BasketLine } from '../basket/totals';
import { offer, shop } from '../../test/planFixtures';
import { withDistance, withinRadius } from './nearby';
import { type Recommendation, recommend } from './recommend';
import { haversineM } from './travel';

// Tiendas sobre una misma calle: A a ~0,4 km de la persona, B a ~1,5 km y C a ~2,6 km.
const ORIGIN = { lat: 4.53, lng: -75.6811 };
const a = shop('a', 'Tienda A', 4.5339);
const b = shop('b', 'Tienda B', 4.5439);
const c = shop('c', 'Tienda C', 4.5539);
// Las fixtures tipan los textos sueltos (type: string): aquí se aceptan como lo que devuelve la API.
const line = (presentationId: string, quantity: number, ...offers: ReturnType<typeof offer>[]) =>
  ({ presentationId, quantity, offers }) as unknown as BasketLine;

// Arroz ×2 y leche ×1: B sola = $8.000; arroz en A y leche en B = $7.000.
const basket = () => [
  line('arroz', 2, offer(a, 'arroz', 2000), offer(b, 'arroz', 2500)),
  line('leche', 1, offer(a, 'leche', 5000), offer(b, 'leche', 3000)),
];
const kinds = (recs: Recommendation[]) => recs.map((r) => r.kinds.join('+'));
const storesOf = (r: Recommendation) => r.option.shares.map(({ store }) => store.id).sort();

describe('withDistance y withinRadius', () => {
  it('calcula la distancia en el dispositivo en una copia, sin mutar la respuesta', () => {
    const lines = basket();
    const copy = withDistance(lines, ORIGIN);
    expect(copy[0]?.offers[0]?.establishment.distanceM).toBe(Math.round(haversineM(ORIGIN, a)));
    expect(lines[0]?.offers[0]?.establishment).not.toHaveProperty('distanceM');
    expect(copy[0]).not.toBe(lines[0]);
  });

  it('filtra por el radio y deja fuera lo que no tiene coordenadas', () => {
    const lost = { ...shop('x', 'Sin mapa', 0), lat: Number.NaN };
    const lines = [
      line('arroz', 1, offer(a, 'arroz', 1), offer(b, 'arroz', 1), offer(lost, 'arroz', 1)),
    ];
    const inside = withinRadius(withDistance(lines, ORIGIN), 1);
    expect(inside[0]?.offers.map((o) => o.establishment.id)).toEqual(['a']);
  });
});

describe('recommend: sin ubicación (solo municipio)', () => {
  it('«La más barata» reparte en 2 tiendas y «Todo en una tienda» dice cuánto cuesta de más', () => {
    const { items, notices } = recommend(basket(), null, 1.5);
    expect(kinds(items)).toEqual(['cheapest', 'single']);
    expect(items[0]).toMatchObject({ productsCop: 7000, covered: 2, total: 2, against: 'single' });
    expect(items[0]?.extraCop).toBe(-1000);
    expect(storesOf(items[0] as Recommendation)).toEqual(['a', 'b']);
    expect(items[1]).toMatchObject({ productsCop: 8000, against: 'cheapest', extraCop: 1000 });
    expect(storesOf(items[1] as Recommendation)).toEqual(['b']);
    expect(notices).toEqual([{ type: 'shareLocation' }]);
  });

  it('no hay «La más cercana» ni «La más barata en el municipio»', () => {
    const { items } = recommend(basket(), null, 1.5);
    expect(items.flatMap((r) => r.kinds)).not.toContain('nearest');
    expect(items.flatMap((r) => r.kinds)).not.toContain('cheapestAll');
  });

  it('si la más barata ya es una sola tienda, no repite «Todo en una tienda»', () => {
    const lines = [line('arroz', 1, offer(a, 'arroz', 1000), offer(b, 'arroz', 1500))];
    const { items } = recommend(lines, null, 1.5);
    expect(kinds(items)).toEqual(['cheapest']);
    expect(items[0]?.extraCop).toBeNull();
  });

  it('una opción de 3 tiendas solo aparece si cuesta menos que la de 2', () => {
    const lines = [
      line('p1', 1, offer(a, 'p1', 100), offer(b, 'p1', 900), offer(c, 'p1', 900)),
      line('p2', 1, offer(a, 'p2', 900), offer(b, 'p2', 100), offer(c, 'p2', 900)),
      line('p3', 1, offer(a, 'p3', 900), offer(b, 'p3', 900), offer(c, 'p3', 100)),
    ];
    const three = recommend(lines, null, 1.5).items[0];
    expect(three?.option.stores).toBe(3);
    expect(three?.productsCop).toBe(300);
    // Si C no baja el precio, el reparto en 3 no aporta nada y no se muestra.
    const same = lines.map((l, i) => (i === 2 ? line('p3', 1, offer(a, 'p3', 100)) : l));
    expect(recommend(same, null, 1.5).items.every((r) => r.option.stores < 3)).toBe(true);
  });

  it('ninguna tienda tiene todo: lo dice y propone la combinación que más cubre', () => {
    const lines = [
      line('p1', 1, offer(a, 'p1', 100)),
      line('p2', 1, offer(b, 'p2', 100)),
      line('p3', 1, offer(c, 'p3', 100)),
      line('p4', 1, offer(shop('d', 'Tienda D', 4.56), 'p4', 100)),
    ];
    const { items, notices } = recommend(lines, null, 1.5);
    expect(items[0]).toMatchObject({ covered: 3, total: 4 });
    expect(items[0]?.notes).toContain('incomplete');
    expect(notices).toContainEqual({ type: 'noneComplete', covered: 3, total: 4 });
  });

  it('un producto sin oferta vigente no cuenta y se informa', () => {
    const lines = [...basket(), line('sal', 1)];
    const result = recommend(lines, null, 1.5);
    expect(result.unpriced).toEqual(['sal']);
    expect(result.items[0]).toMatchObject({ covered: 2, total: 2 });
  });

  it('sin ofertas en absoluto no hay recomendaciones', () => {
    expect(recommend([line('sal', 1)], null, 1.5).items).toEqual([]);
  });
});

describe('recommend: con ubicación', () => {
  it('fusiona etiquetas cuando la más barata es también la más cercana', () => {
    const lines = [
      line('arroz', 2, offer(a, 'arroz', 1000), offer(b, 'arroz', 2500)),
      line('leche', 1, offer(a, 'leche', 3000), offer(b, 'leche', 3500)),
    ];
    const { items, notices } = recommend(lines, ORIGIN, 3);
    expect(kinds(items)).toEqual(['cheapest+nearest']);
    expect(notices).toEqual([]);
  });

  it('«La más cercana» dice cuánto cuesta de más y que puede no ser la más barata', () => {
    const lines = [
      line('arroz', 2, offer(a, 'arroz', 2500), offer(b, 'arroz', 1000)),
      line('leche', 1, offer(a, 'leche', 3500), offer(b, 'leche', 3000)),
    ];
    const { items } = recommend(lines, ORIGIN, 3);
    expect(kinds(items)).toEqual(['cheapest', 'nearest']);
    const nearest = items[1] as Recommendation;
    expect(storesOf(nearest)).toEqual(['a']);
    expect(nearest.extraCop).toBe(3500);
    expect(nearest.notes).toContain('maybeNotCheapest');
    expect(nearest.option.shares[0]?.store.distanceM).toBeLessThan(500);
  });

  it('un radio que deja fuera a la mejor tienda del municipio la ofrece como «La más barata en todo el municipio»', () => {
    const lines = [
      line('arroz', 2, offer(a, 'arroz', 2500), offer(b, 'arroz', 1000)),
      line('leche', 1, offer(a, 'leche', 3500), offer(b, 'leche', 3000)),
    ];
    const { items } = recommend(lines, ORIGIN, 0.5);
    expect(kinds(items)).toEqual(['cheapestAll', 'cheapest+nearest']);
    const all = items[0] as Recommendation;
    expect(storesOf(all)).toEqual(['b']);
    expect(all.extraCop).toBe(-3500);
    expect(all.extraKm).toBeGreaterThan(1);
  });

  it('sin tiendas con tu lista dentro del radio, avisa y muestra las del municipio', () => {
    const far = { lat: 4.6, lng: -75.6811 };
    const { items, notices } = recommend(basket(), far, 0.5);
    expect(notices).toContainEqual({ type: 'noneInRadius', radiusKm: 0.5 });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.productsCop).toBe(7000);
  });

  it('el reparto de 2 o 3 tiendas trae la distancia entre ellas', () => {
    const [first] = recommend(basket(), ORIGIN, 3).items;
    expect(first?.option.stores).toBe(2);
    expect(first?.betweenKm).toBeGreaterThan(1);
    expect(first?.betweenMin).toBeGreaterThan(10);
  });

  it('permutar la entrada no cambia el resultado', () => {
    const lines = basket();
    const reversed = [...lines].reverse().map((l) => ({ ...l, offers: [...l.offers].reverse() }));
    expect(recommend(reversed, ORIGIN, 3)).toEqual(recommend(lines, ORIGIN, 3));
    expect(recommend(reversed, null, 3)).toEqual(recommend(lines, null, 3));
  });
});

// Búsqueda exhaustiva: todos los subconjuntos de hasta 3 tiendas.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const subsets = <T>(items: T[], max: number): T[][] => {
  const out: T[][] = [];
  const walk = (start: number, pick: T[]) => {
    if (pick.length > 0) out.push([...pick]);
    if (pick.length === max) return;
    for (let i = start; i < items.length; i += 1) walk(i + 1, [...pick, items[i] as T]);
  };
  walk(0, []);
  return out;
};
function scenario(next: () => number) {
  const shops = Array.from({ length: 3 + Math.floor(next() * 4) }, (_, i) =>
    shop(`s${String(i)}`, `Tienda ${String(i)}`, 4.5 + next() * 0.06),
  );
  const lines = Array.from({ length: 1 + Math.floor(next() * 4) }, (_, p) =>
    line(
      `p${String(p)}`,
      1 + Math.floor(next() * 3),
      ...shops
        .filter(() => next() < 0.7)
        .map((s) => offer(s, `p${String(p)}`, 100 * (1 + Math.floor(next() * 20)))),
    ),
  );
  return { shops, lines };
}
// El menor total posible (con más productos cubiertos) entre las tiendas permitidas.
function brute(lines: BasketLine[], allowed: Set<string>) {
  let best: { covered: number; cop: number } | null = null;
  for (const combo of subsets([...allowed], 3)) {
    let covered = 0;
    let cop = 0;
    for (const l of lines) {
      const prices = l.offers
        .filter((o) => combo.includes(o.establishment.id))
        .map((o) => o.priceCop);
      if (prices.length === 0) continue;
      covered += 1;
      cop += Math.min(...prices) * l.quantity;
    }
    if (!best || covered > best.covered || (covered === best.covered && cop < best.cop)) {
      best = { covered, cop };
    }
  }
  return best;
}
const dominates = (x: Recommendation, y: Recommendation) =>
  x.covered >= y.covered &&
  x.productsCop <= y.productsCop &&
  x.option.stores <= y.option.stores &&
  x.travelKm <= y.travelKm + 1e-9 &&
  (x.covered > y.covered ||
    x.productsCop < y.productsCop ||
    x.option.stores < y.option.stores ||
    x.travelKm < y.travelKm - 1e-9);

type Summary = { covered?: number; cop?: number };
const sum = (r?: Recommendation): Summary => ({ covered: r?.covered, cop: r?.productsCop });
const dominatedPairs = (items: Recommendation[]) =>
  items.flatMap((x) => items.filter((y) => x !== y && dominates(x, y)).map((y) => [x.id, y.id]));

describe('recommend: propiedades contra búsqueda exhaustiva (semilla fija)', () => {
  it('sin ubicación, «La más barata» es el menor total posible y nada mostrado está dominado', () => {
    const next = seeded(20261121);
    const wrong: unknown[] = [];
    let cases = 0;
    for (let n = 0; n < 150; n += 1) {
      const { shops, lines } = scenario(next);
      const { items } = recommend(lines, null, 1.5);
      const expected = brute(lines, new Set(shops.map((s) => s.id)));
      const priced = lines.some((l) => l.offers.length > 0);
      if (!priced || !expected) {
        if (items.length > 0) wrong.push({ n, items: items.length });
        continue;
      }
      cases += 1;
      const first = items[0];
      if (!first?.kinds.includes('cheapest')) wrong.push({ n, kinds: first?.kinds });
      if (JSON.stringify(sum(first)) !== JSON.stringify(expected))
        wrong.push({ n, got: sum(first), expected });
      if (dominatedPairs(items).length > 0) wrong.push({ n, dominated: dominatedPairs(items) });
    }
    expect(cases).toBeGreaterThanOrEqual(100);
    expect(wrong).toEqual([]);
  });

  it('con ubicación, la más barata del radio y la del municipio son las mejores posibles y nada queda dominado', () => {
    const next = seeded(7);
    const wrong: unknown[] = [];
    let cases = 0;
    for (let n = 0; n < 150; n += 1) {
      const { shops, lines } = scenario(next);
      const radiusKm = 0.5 + next() * 2.5;
      const { items } = recommend(lines, ORIGIN, radiusKm);
      const near = new Set(
        shops.filter((s) => haversineM(ORIGIN, s) <= radiusKm * 1000).map((s) => s.id),
      );
      const municipal = brute(lines, new Set(shops.map((s) => s.id)));
      if (!municipal || !lines.some((l) => l.offers.length > 0)) continue;
      cases += 1;
      const inRadius = brute(lines, near);
      const cheapest = items.find((r) => r.kinds.includes('cheapest'));
      const anyInRadius = lines.some((l) => l.offers.some((o) => near.has(o.establishment.id)));
      const area = anyInRadius && inRadius ? inRadius : municipal;
      if (JSON.stringify(sum(cheapest)) !== JSON.stringify(area))
        wrong.push({ n, area, got: sum(cheapest) });
      const wide = items.find((r) => r.kinds.includes('cheapestAll'));
      const better =
        (wide?.covered ?? 0) > (cheapest?.covered ?? 0) ||
        (wide?.productsCop ?? 0) < (cheapest?.productsCop ?? 0);
      if (wide && (JSON.stringify(sum(wide)) !== JSON.stringify(municipal) || !better)) {
        wrong.push({ n, wide: sum(wide), municipal });
      }
      if (dominatedPairs(items).length > 0) wrong.push({ n, dominated: dominatedPairs(items) });
    }
    expect(cases).toBeGreaterThanOrEqual(100);
    expect(wrong).toEqual([]);
  });
});
