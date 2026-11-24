interface Point {
  date: string;
  minPriceCop: number;
}

export type Direction = 'sube' | 'baja' | 'igual';
export interface Change {
  percent: number;
  direction: Direction;
}
export interface HistoryStats {
  min: number;
  max: number;
  latest: { priceCop: number; date: string; isToday: boolean };
  // Del primer al último día con precios; con un solo día no hay variación.
  change: Change | null;
}

// El resumen de arriba del historial, de los mismos puntos que ya muestran la gráfica y la tabla (el
// precio más bajo de cada día, de más antiguo a más reciente). `to` es el último día del periodo (hoy).
export function historyStats(points: Point[], to: string): HistoryStats | null {
  const [first] = points;
  const last = points.at(-1);
  if (!first || !last) return null;
  const prices = points.map(({ minPriceCop }) => minPriceCop);
  const delta = last.minPriceCop - first.minPriceCop;
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    latest: { priceCop: last.minPriceCop, date: last.date, isToday: last.date === to },
    change:
      points.length < 2
        ? null
        : {
            percent: Math.round((Math.abs(delta) / first.minPriceCop) * 100),
            direction: delta > 0 ? 'sube' : delta < 0 ? 'baja' : 'igual',
          },
  };
}

// La variación en palabras: la dirección va en el texto, no solo en el color.
export function changeText(change: Change | null): string {
  if (!change) return 'Sin variación';
  if (change.direction === 'igual') return 'Sin cambio';
  const verb = change.direction === 'sube' ? 'Sube' : 'Baja';
  return change.percent === 0 ? `${verb} menos de 1 %` : `${verb} ${String(change.percent)} %`;
}
