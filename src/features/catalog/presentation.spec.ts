import { describe, expect, it } from 'vitest';
import { formatPresentation } from './presentation';

describe('presentación como se lee en el empaque', () => {
  it.each([
    [{ quantity: 500, unit: 'g', packCount: 1 }, '500 g'],
    [{ quantity: 1, unit: 'kg', packCount: 1 }, '1 kg'],
    [{ quantity: 12, unit: 'und', packCount: 1 }, '12 und'],
  ] as const)('%o se escribe «%s»', (presentation, text) => {
    expect(formatPresentation(presentation)).toBe(text);
  });

  it('un empaque de varias unidades dice cuántas trae: «6 × 330 ml»', () => {
    expect(formatPresentation({ quantity: 330, unit: 'ml', packCount: 6 })).toBe('6 × 330 ml');
  });
});
