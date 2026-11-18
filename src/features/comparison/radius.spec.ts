import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_RADIUS_KM,
  normalizeRadius,
  radiusLabel,
  radiusSpoken,
  readRadius,
  saveRadius,
} from './radius';

describe('radio de búsqueda', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sin elección usa 1,5 km', () => {
    expect(readRadius()).toBe(DEFAULT_RADIUS_KM);
  });

  it('recuerda un preajuste', () => {
    saveRadius(3);
    expect(readRadius()).toBe(3);
  });

  it('recuerda cualquier valor entre 0,5 y 3 km, a décimas', () => {
    localStorage.setItem('valora:radio', '2.3');
    expect(readRadius()).toBe(2.3);
    localStorage.setItem('valora:radio', '1.2000000000000002');
    expect(readRadius()).toBe(1.2);
    localStorage.setItem('valora:radio', '1.26');
    expect(readRadius()).toBe(1.3);
  });

  it.each(['7', '0.4', '3.01', '0', '-1', 'abc', 'NaN', 'Infinity', ''])(
    'ignora el valor guardado inválido «%s»',
    (saved) => {
      localStorage.setItem('valora:radio', saved);
      expect(readRadius()).toBe(DEFAULT_RADIUS_KM);
    },
  );

  it('acepta los dos extremos', () => {
    localStorage.setItem('valora:radio', '0.5');
    expect(readRadius()).toBe(0.5);
    localStorage.setItem('valora:radio', '3');
    expect(readRadius()).toBe(3);
  });

  it('normaliza a décimas y dentro de los límites', () => {
    expect(normalizeRadius(0.1)).toBe(0.5);
    expect(normalizeRadius(9)).toBe(3);
    expect(normalizeRadius(1.2000000000000002)).toBe(1.2);
  });

  it('lo escribe con coma', () => {
    expect(radiusLabel(0.5)).toBe('0,5 km');
    expect(radiusLabel(2)).toBe('2 km');
  });

  it('lo dice completo para el lector de pantalla', () => {
    expect(radiusSpoken(1.5)).toBe('1,5 kilómetros');
    expect(radiusSpoken(1)).toBe('1 kilómetro');
  });
});
