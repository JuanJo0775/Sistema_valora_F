import type { components } from '../api/schema';

type Reliability = components['schemas']['ComparisonItem']['reliability'];

// El nivel lo calcula el backend (RF-011); aquí solo se nombra y se colorea como en el prototipo.
const LABELS: Record<Reliability, { text: string; tone: string }> = {
  alta: { text: 'Confiabilidad alta', tone: 'ok' },
  media: { text: 'Confiabilidad media', tone: 'warn' },
  baja: { text: 'Confiabilidad baja', tone: 'bad' },
  en_revision: { text: 'En revisión', tone: 'mute' },
};

export function ReliabilityBadge({ level }: { level: Reliability }) {
  const { text, tone } = LABELS[level];
  return <span className={`pill ${tone}`}>{text}</span>;
}
