import { describe, expect, it } from 'vitest';
import { ApiError } from '../../shared/api';
import { humanizeError, humanizeFields } from './fieldLabels';

describe('nombres de campo del servidor en palabras de la persona', () => {
  it('cambia «packCount» por su etiqueta', () => {
    expect(humanizeFields('packCount: debe ser un entero mayor o igual a 1')).toBe(
      'Unidades en el empaque: debe ser un entero mayor o igual a 1',
    );
  });

  it('dice el código de barras sin el nombre interno', () => {
    expect(humanizeFields('barcode: no es un código de barras válido')).toBe(
      'El código de barras no es válido: tiene de 8 a 14 dígitos.',
    );
  });

  it('traduce varios campos y deja el resto igual', () => {
    expect(humanizeFields('quantity: debe ser mayor que 0; categoryCode: no existe')).toBe(
      'Cantidad: debe ser mayor que 0; Categoría: no existe',
    );
    expect(humanizeFields('Demasiados intentos.')).toBe('Demasiados intentos.');
  });

  it('conserva el estado y el código del error', () => {
    const error = humanizeError(
      new ApiError({ status: 400, code: 'VALIDATION_ERROR', message: 'packCount: no vale' }),
    );
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect((error as Error).message).toBe('Unidades en el empaque: no vale');
  });
});
