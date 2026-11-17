import type { components } from '../api/schema';
import { daysAgo, relativeDay } from '../days';

type Freshness = components['schemas']['ComparisonItem']['freshness'];

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
  if (freshness === 'desactualizado') return <span className="pill bad">Desactualizado</span>;
  const days = daysAgo(observedAt, now);
  if (freshness === 'por_confirmar') {
    return <span className="pill warn">{`Por confirmar · ${String(days)} días`}</span>;
  }
  return <span className="pill ok">{relativeDay(observedAt, now)}</span>;
}
