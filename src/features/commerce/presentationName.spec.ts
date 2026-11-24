import { describe, expect, it } from 'vitest';
import { serverName } from './presentationName';

describe('serverName', () => {
  it('une el producto y la presentación', () => {
    expect(serverName({ productName: 'Arroz blanco Diana', presentationLabel: '1 kg' })).toBe(
      'Arroz blanco Diana · 1 kg',
    );
  });
  it('solo el producto si la presentación viene vacía', () => {
    expect(serverName({ productName: 'Producto sin nombre', presentationLabel: '' })).toBe(
      'Producto sin nombre',
    );
  });
  it('devuelve undefined si el backend no manda el nombre', () => {
    expect(serverName({})).toBeUndefined();
    expect(serverName({ presentationLabel: '1 kg' })).toBeUndefined();
  });
});
