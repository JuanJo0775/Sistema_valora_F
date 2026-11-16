import type { components } from '../api/schema';

type Freshness = components['schemas']['ComparisonItem']['freshness'];

// Fecha de calendario en Colombia (AAAA-MM-DD): «hoy» y «ayer» se cuentan con la hora del Quindío.
const colombianDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(observedAt: string, now: Date): number {
  const day = (date: Date) => Date.parse(colombianDay.format(date));
  return Math.round((day(now) - day(new Date(observedAt))) / DAY_MS);
}

// La vigencia la decide el backend (RF-010); aquí solo se dice hace cuánto se vio el precio.
export function FreshnessBadge({
  freshness,
  observedAt,
  now = new Date(),
}: {
  freshness: Freshness;
  observedAt: string;
  now?: Date;
}) {
  const days = daysAgo(observedAt, now);
  if (freshness === 'por_confirmar') {
    return <span className="pill warn">{`Por confirmar · ${String(days)} días`}</span>;
  }
  const text = days === 0 ? 'Hoy' : days === 1 ? 'Ayer' : `Hace ${String(days)} días`;
  return <span className="pill ok">{text}</span>;
}
