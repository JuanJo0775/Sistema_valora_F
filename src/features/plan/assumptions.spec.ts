import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAssumptions, saveAssumptions } from './assumptions';
import { DEFAULT_ASSUMPTIONS, type TravelAssumptions } from './travel';

const KEY = 'valora:plan-supuestos';

describe('supuestos del plan', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sin nada guardado usa los supuestos por defecto', () => {
    expect(readAssumptions()).toEqual(DEFAULT_ASSUMPTIONS);
  });

  it('lo que se guarda se lee igual', () => {
    const a: TravelAssumptions = { ...DEFAULT_ASSUMPTIONS, mode: 'fare', fareCop: 2500 };
    saveAssumptions(a);
    expect(readAssumptions()).toEqual(a);
  });

  it('el rodeo y la velocidad ya no se eligen: lo guardado antes se ignora', () => {
    saveAssumptions({ detour: 1.5, kmh: 5, mode: 'perKm', perKmCop: 800 });
    expect(readAssumptions()).toEqual({ ...DEFAULT_ASSUMPTIONS, mode: 'perKm', perKmCop: 800 });
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toMatchObject({ v: 1 });
  });

  it('guarda también el costo por km', () => {
    const a: TravelAssumptions = { detour: 1.3, kmh: 4.5, mode: 'perKm', perKmCop: 800 };
    saveAssumptions(a);
    expect(readAssumptions()).toEqual(a);
  });

  it.each([
    'no es json',
    '{"v":2,"detour":1.5,"kmh":5,"mode":"none"}',
    '{"v":1,"detour":"x","kmh":5,"mode":"none"}',
    '{"v":1,"detour":0.5,"kmh":5,"mode":"none"}',
    '{"v":1,"detour":1.3,"kmh":0,"mode":"none"}',
    '{"v":1,"detour":1.3,"kmh":4.5,"mode":"taxi"}',
    '{"v":1,"detour":1.3,"kmh":4.5,"mode":"fare","fareCop":-5}',
    'null',
    '[]',
  ])('un valor dañado o de otra versión devuelve los por defecto: %s', (raw) => {
    localStorage.setItem(KEY, raw);
    expect(readAssumptions()).toEqual(DEFAULT_ASSUMPTIONS);
  });

  it('con el almacenamiento bloqueado no lanza', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(readAssumptions()).toEqual(DEFAULT_ASSUMPTIONS);
    expect(() => {
      saveAssumptions(DEFAULT_ASSUMPTIONS);
    }).not.toThrow();
  });
});
