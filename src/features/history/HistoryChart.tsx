import { formatCop } from '../../shared/money';
import { shortDay } from '../../shared/days';

interface Point {
  date: string;
  minPriceCop: number;
}

const WIDTH = 320;
const HEIGHT = 140;
const PAD = { top: 12, right: 12, bottom: 22, left: 52 };
const DAY_MS = 24 * 60 * 60 * 1000;

// Día de calendario como número, sin zona horaria («2026-11-14» → días desde 1970).
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

// Tramos de días seguidos: entre dos días con precios separados por días sin datos no se dibuja
// línea, para no inventar precios (#17).
function runsOf(points: Point[]): Point[][] {
  const runs: Point[][] = [];
  for (const point of points) {
    const last = runs.at(-1);
    const previous = last?.at(-1);
    if (last && previous && dayNumber(point.date) - dayNumber(previous.date) === 1)
      last.push(point);
    else runs.push([point]);
  }
  return runs;
}

// Una sola serie (el precio más bajo de cada día): sin leyenda, el título la nombra. La tabla de
// la pantalla tiene los mismos datos para quien no ve la gráfica.
export function HistoryChart({
  points,
  from,
  to,
  label,
}: {
  points: Point[];
  from: string;
  to: string;
  label: string;
}) {
  const [first] = points;
  const last = points.at(-1);
  if (!first || !last) return null;
  // Con un solo precio no hay tendencia que dibujar: una tarjeta compacta dice cuál es.
  if (points.length < 2) {
    return (
      <p className="history-single">
        {`Hasta ahora hay un solo precio registrado: ${formatCop(last.minPriceCop)} el ${shortDay(last.date)}.`}
      </p>
    );
  }
  const prices = points.map(({ minPriceCop }) => minPriceCop);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const spread = high - low || high * 0.1 || 1;
  const span = Math.max(dayNumber(to) - dayNumber(from), 1);
  const x = (date: string) =>
    PAD.left + ((dayNumber(date) - dayNumber(from)) / span) * (WIDTH - PAD.left - PAD.right);
  const y = (price: number) =>
    PAD.top +
    (1 - (price - (low - spread * 0.1)) / (spread * 1.2)) * (HEIGHT - PAD.top - PAD.bottom);
  const summary = `Precio más bajo por día · ${label}: de ${formatCop(first.minPriceCop)} el ${shortDay(first.date)} a ${formatCop(last.minPriceCop)} el ${shortDay(last.date)}`;

  return (
    <svg
      className="history-chart"
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      role="img"
      aria-label={summary}
    >
      <line
        className="axis"
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={HEIGHT - PAD.bottom}
        y2={HEIGHT - PAD.bottom}
      />
      <text
        className="tick"
        x={PAD.left - 6}
        y={y(high)}
        textAnchor="end"
        dominantBaseline="middle"
      >
        {formatCop(high)}
      </text>
      {high !== low && (
        <text
          className="tick"
          x={PAD.left - 6}
          y={y(low)}
          textAnchor="end"
          dominantBaseline="middle"
        >
          {formatCop(low)}
        </text>
      )}
      <text className="tick" x={PAD.left} y={HEIGHT - 6}>
        {shortDay(from)}
      </text>
      <text className="tick" x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end">
        {shortDay(to)}
      </text>
      {runsOf(points).map((run) => (
        <polyline
          key={run[0]?.date}
          className="line"
          points={run
            .map((point) => `${String(x(point.date))},${String(y(point.minPriceCop))}`)
            .join(' ')}
        />
      ))}
      {points.map((point) => (
        <g key={point.date}>
          <circle className="dot" cx={x(point.date)} cy={y(point.minPriceCop)} r={4} />
          {/* Área de toque más grande que el punto, con el valor al pasar el puntero. */}
          <circle className="hit" cx={x(point.date)} cy={y(point.minPriceCop)} r={12}>
            <title>{`${shortDay(point.date)}: ${formatCop(point.minPriceCop)}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
