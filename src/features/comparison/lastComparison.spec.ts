import { beforeEach, describe, expect, it } from 'vitest';
import type { Comparison } from './AllStores';
import { ago, comparisonKey, readComparison, saveComparison } from './lastComparison';

const sample = (n: number) =>
  ({ productId: `p${String(n)}`, results: [] }) as unknown as Comparison;
const key = (productId: string, located = false) =>
  comparisonKey({ productId, located, where: 'armenia', sort: 'unit_price', onlyCurrent: false });

describe('última comparación vista (sin conexión)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('guarda y devuelve la comparación por municipio', () => {
    saveComparison(key('a'), sample(1), 1000);

    expect(readComparison(key('a'), 2000)).toEqual({ comparison: sample(1), savedAt: 1000 });
  });

  it('con la ubicación no hay clave: nada se guarda (EC-08)', () => {
    expect(key('a', true)).toBeNull();
    saveComparison(key('a', true), sample(1));

    expect(localStorage.getItem('valora:comparaciones')).toBeNull();
    expect(readComparison(key('a', true))).toBeNull();
  });

  it('vence a los tres días y conserva pocas entradas', () => {
    saveComparison(key('a'), sample(1), 0);
    expect(readComparison(key('a'), 4 * 24 * 60 * 60 * 1000)).toBeNull();

    for (let n = 0; n < 12; n += 1) saveComparison(key(`p${String(n)}`), sample(n), 10);
    const stored = JSON.parse(localStorage.getItem('valora:comparaciones') ?? '[]') as unknown[];
    expect(stored).toHaveLength(8);
  });

  it('un almacenamiento dañado no rompe', () => {
    localStorage.setItem('valora:comparaciones', '{no es json');

    expect(readComparison(key('a'))).toBeNull();
  });

  it('dice hace cuánto', () => {
    expect(ago(0, 30_000)).toBe('hace un momento');
    expect(ago(0, 5 * 60_000)).toBe('hace 5 min');
    expect(ago(0, 3 * 3_600_000)).toBe('hace 3 h');
    expect(ago(0, 2 * 86_400_000)).toBe('hace 2 días');
  });
});
