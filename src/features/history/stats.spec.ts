import { describe, expect, it } from 'vitest';
import { changeText, historyStats } from './stats';

const p = (date: string, minPriceCop: number) => ({ date, minPriceCop });

describe('resumen del historial', () => {
  it('sin puntos no hay resumen', () => {
    expect(historyStats([], '2026-11-16')).toBeNull();
  });

  it('da el mínimo, el máximo, el último precio y la variación del primero al último', () => {
    const stats = historyStats(
      [p('2026-11-10', 2000), p('2026-11-12', 2400), p('2026-11-16', 2200)],
      '2026-11-16',
    );
    expect(stats).toEqual({
      min: 2000,
      max: 2400,
      latest: { priceCop: 2200, date: '2026-11-16', isToday: true },
      change: { percent: 10, direction: 'sube' },
    });
  });

  it('el último precio no es de hoy si el último día con precios es anterior', () => {
    const stats = historyStats([p('2026-11-10', 2000), p('2026-11-14', 1900)], '2026-11-16');
    expect(stats?.latest).toEqual({ priceCop: 1900, date: '2026-11-14', isToday: false });
    expect(stats?.change).toEqual({ percent: 5, direction: 'baja' });
  });

  it('con un solo precio no hay variación', () => {
    expect(historyStats([p('2026-11-16', 2300)], '2026-11-16')?.change).toBeNull();
  });

  it('el mismo precio del primero al último es «igual»; un cambio menor de 1 % se dice tal cual', () => {
    expect(
      historyStats([p('2026-11-10', 2000), p('2026-11-16', 2000)], '2026-11-16')?.change,
    ).toEqual({ percent: 0, direction: 'igual' });
    expect(
      historyStats([p('2026-11-10', 100_000), p('2026-11-16', 100_100)], '2026-11-16')?.change,
    ).toEqual({ percent: 0, direction: 'sube' });
  });

  it('el texto de la variación no depende del color', () => {
    expect(changeText({ percent: 10, direction: 'sube' })).toBe('Sube 10 %');
    expect(changeText({ percent: 5, direction: 'baja' })).toBe('Baja 5 %');
    expect(changeText({ percent: 0, direction: 'igual' })).toBe('Sin cambio');
    expect(changeText({ percent: 0, direction: 'sube' })).toBe('Sube menos de 1 %');
    expect(changeText({ percent: 0, direction: 'baja' })).toBe('Baja menos de 1 %');
    expect(changeText(null)).toBe('Sin variación');
  });
});
