import { describe, expect, it } from 'vitest';
import { parsePrice } from './price';

describe('precio como lo escribe la gente', () => {
  it.each([
    ['4600', 4600],
    ['4.600', 4600],
    ['$4.600', 4600],
    ['$ 1.490', 1490],
    ['1490,00', 1490],
    ['1.490,00', 1490],
    ['10.000.000', 10_000_000],
  ])('«%s» son %i pesos', (text, pesos) => {
    expect(parsePrice(text)).toEqual({ pesos });
  });

  it.each([
    ['', 'Escribe el precio en pesos.'],
    ['abc', 'Escribe solo números, por ejemplo 4600 o $4.600.'],
    ['-5', 'Escribe solo números, por ejemplo 4600 o $4.600.'],
    ['2,5', 'Escribe el precio en pesos enteros, sin centavos.'],
    ['1490,50', 'Escribe el precio en pesos enteros, sin centavos.'],
    ['0', 'El precio debe ser mayor que 0.'],
    ['10.000.001', 'El precio no puede pasar de $10.000.000.'],
  ])('«%s» se explica: %s', (text, problem) => {
    expect(parsePrice(text)).toEqual({ problem });
  });
});
