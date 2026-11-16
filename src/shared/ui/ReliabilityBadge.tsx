import type { components } from '../api/schema';

type Reliability = components['schemas']['ComparisonItem']['reliability'];

export function ReliabilityBadge(_props: { level: Reliability }) {
  return null;
}
