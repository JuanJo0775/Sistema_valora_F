import { describe, expect, it } from 'vitest';
import { judgePrice, referenceFrom, suggestPrice } from './plausibility';

const offer = (priceCop: number, extra: Record<string, unknown> = {}) =>
  ({
    presentationId: 'p1',
    priceCop,
    freshness: 'vigente',
    reliability: 'alta',
    ...extra,
  }) as never;

describe('referenceFrom', () => {
  it('calcula mínimo, máximo y mediana solo con los vigentes de esa presentación', () => {
    const reference = referenceFrom(
      [
        offer(2000),
        offer(3000),
        offer(2500),
        offer(1, { presentationId: 'otra' }),
        offer(9, { freshness: 'por_confirmar' }),
        offer(8, { reliability: 'en_revision' }),
      ],
      'p1',
    );
    expect(reference).toEqual({ min: 2000, max: 3000, median: 2500, count: 3 });
  });

  it('con una cantidad par, la mediana es el promedio de los dos del medio', () => {
    expect(referenceFrom([offer(2000), offer(3000)], 'p1')?.median).toBe(2500);
  });

  it('con menos de 2 precios no hay referencia', () => {
    expect(referenceFrom([offer(2000)], 'p1')).toBeNull();
    expect(referenceFrom([], 'p1')).toBeNull();
  });
});

describe('judgePrice', () => {
  const reference = { min: 900, max: 1100, median: 1000, count: 3 };

  it('el límite de abajo es 40 % de la mediana', () => {
    expect(judgePrice(399, reference)).toBe('atipico');
    expect(judgePrice(400, reference)).toBe('ok');
  });

  it('el límite de arriba es 250 % de la mediana', () => {
    expect(judgePrice(2500, reference)).toBe('ok');
    expect(judgePrice(2501, reference)).toBe('atipico');
  });

  it('menos de $100 es imposible, con o sin referencia', () => {
    expect(judgePrice(99, null)).toBe('imposible');
    expect(judgePrice(99, reference)).toBe('imposible');
    expect(judgePrice(100, null)).toBe('ok');
  });

  it('sin referencia no hay atípico', () => {
    expect(judgePrice(9_000_000, null)).toBe('ok');
  });
});

describe('suggestPrice', () => {
  const reference = { min: 1990, max: 2800, median: 2400, count: 3 };

  it.each([
    [120, 1200, { min: 1000, max: 1500, median: 1200, count: 2 }],
    [12, 1200, { min: 1000, max: 1500, median: 1200, count: 2 }],
    [1, 1000, { min: 1000, max: 1500, median: 1200, count: 2 }],
    [2, 2000, reference],
  ])('%i se corrige a %i', (typed, expected, ref) => {
    // 12 -> ×10 = 120 (fuera) -> ×100 = 1200 (dentro)
    expect(suggestPrice(typed, ref)).toBe(expected);
  });

  it('si ningún múltiplo cae en el rango, no sugiere', () => {
    expect(suggestPrice(7, reference)).toBeNull();
  });
});
