import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RADIUS_KM, radiusLabel, readRadius, saveRadius } from './radius';

describe('radio de búsqueda', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sin elección usa 1,5 km', () => {
    expect(readRadius()).toBe(DEFAULT_RADIUS_KM);
  });

  it('recuerda uno de los valores permitidos', () => {
    saveRadius(3);
    expect(readRadius()).toBe(3);
  });

  it('ignora un valor guardado que no es de la lista', () => {
    localStorage.setItem('valora:radio', '7');
    expect(readRadius()).toBe(DEFAULT_RADIUS_KM);
  });

  it('lo escribe con coma', () => {
    expect(radiusLabel(0.5)).toBe('0,5 km');
  });
});
