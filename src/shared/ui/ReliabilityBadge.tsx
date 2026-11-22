import type { components } from '../api/schema';

type Reliability = components['schemas']['ComparisonItem']['reliability'];

// El nivel lo calcula el backend (RF-011); aquí solo se nombra y se colorea. El rojo queda para lo que es una
// advertencia de verdad (precio desactualizado): la confiabilidad baja va en ámbar y la media, neutra.
const LABELS: Record<NonNullable<Reliability>, { text: string; tone: string }> = {
  alta: { text: 'Confiabilidad alta', tone: 'ok' },
  media: { text: 'Confiabilidad media', tone: 'mute' },
  baja: { text: 'Confiabilidad baja', tone: 'warn' },
  en_revision: { text: 'En revisión', tone: 'mute' },
};

export function ReliabilityBadge({ level }: { level: Reliability }) {
  if (!level) return null;
  const { text, tone } = LABELS[level];
  return <span className={`pill ${tone}`}>{text}</span>;
}
