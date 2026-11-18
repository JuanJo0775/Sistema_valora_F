import { describe, expect, it } from 'vitest';
import type { components } from '../../shared/api/schema';
import type { BasketLine } from '../basket/totals';
import { bestSplits } from './split';

type Offer = components['schemas']['ComparisonItem'];

const store = (id: string, name: string, distanceM?: number) => ({
  id,
  name,
  type: 'barrio' as const,
  lat: 4.53,
  lng: -75.68,
  municipality: 'armenia' as const,
  ...(distanceM === undefined ? {} : { distanceM }),
});

const offer = (
  where: ReturnType<typeof store>,
  presentationId: string,
  priceCop: number,
  extra: Partial<Offer> = {},
): Offer => ({
  establishment: where,
  reportId: `${where.id}-${presentationId}-${String(priceCop)}`,
  presentationId,
  priceCop,
  unitPrice: { valueCop: priceCop, per: 'und' },
  source: 'comunidad',
  freshness: 'vigente',
  reliability: 'alta',
  confirmations: 1,
  isCheapest: false,
  observedAt: '2026-11-16T15:00:00Z',
  ...extra,
});

const A = store('a', 'A');
const B = store('b', 'B');

const arrozLeche = (): BasketLine[] => [
  {
    presentationId: 'arroz',
    quantity: 2,
    offers: [offer(A, 'arroz', 2000), offer(B, 'arroz', 2500)],
  },
  {
    presentationId: 'leche',
    quantity: 1,
    offers: [offer(A, 'leche', 5000), offer(B, 'leche', 3000)],
  },
];

// Barajador determinista (mulberry32) para no depender de Math.random.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled<T>(items: T[], next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}
const shuffleLines = (lines: BasketLine[], next: () => number): BasketLine[] =>
  shuffled(lines, next).map((line) => ({ ...line, offers: shuffled(line.offers, next) }));

describe('reparto de la canasta entre tiendas', () => {
  it('reparte 2 arroz y 1 leche entre dos tiendas', () => {
    const { options } = bestSplits(arrozLeche(), 2);

    expect(options.map((o) => o.stores)).toEqual([1, 2]);
    const [one, two] = options;
    expect(one?.shares).toHaveLength(1);
    expect(one?.shares[0]?.store.id).toBe('b');
    expect(one?.productsCop).toBe(8000);
    expect(one?.savingsVsBestSingleCop).toBe(0);

    expect(two?.productsCop).toBe(7000);
    expect(two?.savingsVsBestSingleCop).toBe(1000);
    const arroz = two?.shares.find((s) => s.lines.some((l) => l.presentationId === 'arroz'));
    const leche = two?.shares.find((s) => s.lines.some((l) => l.presentationId === 'leche'));
    expect(arroz?.store.id).toBe('a');
    expect(arroz?.lines).toEqual([
      { presentationId: 'arroz', quantity: 2, unitCop: 2000, lineCop: 4000 },
    ]);
    expect(arroz?.subtotalCop).toBe(4000);
    expect(leche?.store.id).toBe('b');
    expect(leche?.subtotalCop).toBe(3000);
  });

  it('una línea sin oferta va a unpriced y no cuenta en el total', () => {
    const base = bestSplits(arrozLeche(), 2);
    const result = bestSplits(
      [...arrozLeche(), { presentationId: 'sal', quantity: 1, offers: [] }],
      2,
    );

    expect(result.unpriced).toEqual(['sal']);
    expect(result.options.map((o) => o.productsCop)).toEqual(
      base.options.map((o) => o.productsCop),
    );
  });

  it('una presentación distinta no cuenta', () => {
    const result = bestSplits(
      [
        ...arrozLeche(),
        { presentationId: 'sal-500g', quantity: 1, offers: [offer(A, 'sal-1kg', 1500)] },
      ],
      2,
    );

    expect(result.unpriced).toEqual(['sal-500g']);
    expect(result.options[0]?.productsCop).toBe(8000);
  });

  it('dos ofertas de la misma tienda para la misma presentación usan la más barata', () => {
    const { options } = bestSplits(
      [
        {
          presentationId: 'arroz',
          quantity: 1,
          offers: [offer(A, 'arroz', 3000), offer(A, 'arroz', 2200), offer(A, 'arroz', 2800)],
        },
      ],
      2,
    );

    expect(options).toHaveLength(1);
    expect(options[0]?.productsCop).toBe(2200);
    expect(options[0]?.shares[0]?.lines).toEqual([
      { presentationId: 'arroz', quantity: 1, unitCop: 2200, lineCop: 2200 },
    ]);
  });

  it('tiendas con el mismo vector de precios se agrupan', () => {
    const d1a = store('d1-a', 'D1 a', 900);
    const d1b = store('d1-b', 'D1 b', 300);
    const { options } = bestSplits(
      [
        {
          presentationId: 'arroz',
          quantity: 1,
          offers: [offer(d1a, 'arroz', 2000), offer(d1b, 'arroz', 2000)],
        },
      ],
      3,
    );

    expect(options).toHaveLength(1);
    expect(options[0]?.shares).toHaveLength(1);
    expect(options[0]?.shares[0]?.store.id).toBe('d1-b');
    expect(options[0]?.shares[0]?.equivalentStores).toBe(2);
  });

  it('empate de total se resuelve por distancia y luego por identificadores', () => {
    // {a,b} y {c,b} suman lo mismo; a y c difieren solo en la leche, para no ser equivalentes.
    const mk = (idA: string, idC: string, distA: number, distC: number) => {
      const a = store(idA, idA, distA);
      const b = store('m', 'M', 100);
      const c = store(idC, idC, distC);
      return [
        {
          presentationId: 'arroz',
          quantity: 1,
          offers: [offer(a, 'arroz', 1000), offer(c, 'arroz', 1000), offer(b, 'arroz', 3000)],
        },
        {
          presentationId: 'leche',
          quantity: 1,
          offers: [offer(a, 'leche', 3000), offer(c, 'leche', 3001), offer(b, 'leche', 1000)],
        },
      ] satisfies BasketLine[];
    };
    const idsOfTwo = (lines: BasketLine[]) =>
      bestSplits(lines, 2)
        .options.find((o) => o.stores === 2)
        ?.shares.map((s) => s.store.id)
        .sort();

    // Por distancia: gana la combinación con la tienda más cercana.
    expect(idsOfTwo(mk('a', 'c', 900, 300))).toEqual(['c', 'm']);
    expect(idsOfTwo(mk('a', 'c', 300, 900))).toEqual(['a', 'm']);
    // Mismas distancias: ganan los ids menores, comparados carácter por carácter.
    expect(idsOfTwo(mk('a', 'c', 500, 500))).toEqual(['a', 'm']);
    expect(idsOfTwo(mk('x10', 'x9', 500, 500))).toEqual(['m', 'x10']);
  });

  it('una combinación solo cuenta si cada tienda recibe al menos una línea', () => {
    const caro = store('caro', 'Caro');
    const lines: BasketLine[] = [
      {
        presentationId: 'arroz',
        quantity: 1,
        offers: [offer(A, 'arroz', 2000), offer(caro, 'arroz', 2100)],
      },
      {
        presentationId: 'leche',
        quantity: 1,
        offers: [offer(A, 'leche', 3000), offer(caro, 'leche', 3100)],
      },
    ];
    const { options } = bestSplits(lines, 3);

    // A es siempre la más barata: caro nunca recibe nada, así que no hay opción de 2 ni de 3.
    expect(options.map((o) => o.stores)).toEqual([1]);
    expect(options[0]?.shares[0]?.store.id).toBe('a');
  });

  it('con 3 tiendas poda a 15 candidatas', () => {
    const stores = Array.from({ length: 40 }, (_, i) =>
      store(`s${String(i).padStart(2, '0')}`, `S${String(i)}`),
    );
    const lines: BasketLine[] = ['p1', 'p2', 'p3', 'p4'].map((id, li) => ({
      presentationId: id,
      quantity: 1 + li,
      offers: stores.map((s, i) => offer(s, id, 1000 + ((i * 37 + li * 11) % 53) * 10 + i)),
    }));

    const result = bestSplits(lines, 3);
    expect(result.options.map((o) => o.stores)).toEqual([1, 2, 3]);
    expect(result.options[2]?.shares.length).toBeLessThanOrEqual(3);
    expect(bestSplits(shuffleLines(lines, rng(7)), 3)).toEqual(result);
  });

  it('permutar el orden de entrada no cambia el resultado', () => {
    const stores = Array.from({ length: 8 }, (_, i) =>
      store(`t${String(i)}`, `T${String(i)}`, 100 + ((i * 7) % 5) * 100),
    );
    const lines: BasketLine[] = ['a1', 'a2', 'a3', 'a4', 'a5'].map((id, li) => ({
      presentationId: id,
      quantity: 1 + (li % 3),
      offers: stores
        .filter((_, i) => (i + li) % 4 !== 0)
        .map((s, i) => offer(s, id, 1500 + ((i * 13 + li * 7) % 6) * 100)),
    }));
    const expected = bestSplits(lines, 3);
    const next = rng(42);

    for (let i = 0; i < 20; i += 1) {
      expect(bestSplits(shuffleLines(lines, next), 3)).toEqual(expected);
    }
  });

  it('sin líneas devuelve options vacío y unpriced vacío', () => {
    expect(bestSplits([], 3)).toEqual({ options: [], unpriced: [] });
  });

  it('si todas las líneas están sin precio vigente, no hay opciones y todas van a unpriced', () => {
    const result = bestSplits(
      [
        { presentationId: 'sal', quantity: 1, offers: [] },
        { presentationId: 'azucar', quantity: 1, offers: [offer(A, 'otra', 1000)] },
      ],
      3,
    );

    expect(result.options).toEqual([]);
    expect(result.unpriced).toEqual(['azucar', 'sal']);
  });

  it('savingsVsBestSingleCop es null si ninguna tienda sola tiene todo', () => {
    const { options } = bestSplits(
      [
        { presentationId: 'arroz', quantity: 1, offers: [offer(A, 'arroz', 2000)] },
        { presentationId: 'leche', quantity: 1, offers: [offer(B, 'leche', 3000)] },
      ],
      2,
    );

    // La opción de 1 tienda existe pero queda incompleta; la de 2 cubre todo.
    expect(options.map((o) => o.stores)).toEqual([1, 2]);
    expect(options[1]?.productsCop).toBe(5000);
    expect(options.map((o) => o.savingsVsBestSingleCop)).toEqual([null, null]);
  });

  it('ningún campo comercial influye', () => {
    const plain = bestSplits(arrozLeche(), 3);
    const commercial = bestSplits(
      arrozLeche().map((line, i) => ({
        ...line,
        offers: line.offers.map((o, j) => ({
          ...o,
          source: (['siembra', 'comunidad', 'oficial'] as const)[(i + j) % 3] ?? 'comunidad',
          reliability: (['alta', 'media', 'baja'] as const)[(i + j) % 3] ?? 'alta',
          establishment: { ...o.establishment, type: j % 2 === 0 ? 'cadena' : 'descuento' },
        })),
      })) as BasketLine[],
      3,
    );

    // Se compara todo salvo el tipo de tienda, que es un dato de la propia tienda.
    const strip = (r: typeof plain) =>
      JSON.parse(JSON.stringify(r, (k, v: unknown) => (k === 'type' ? undefined : v))) as unknown;
    expect(strip(commercial)).toEqual(strip(plain));
  });
});
