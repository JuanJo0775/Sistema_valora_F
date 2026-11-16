import type { components } from '../api/schema';

type Freshness = components['schemas']['ComparisonItem']['freshness'];

export function FreshnessBadge(_props: { freshness: Freshness; observedAt: string; now?: Date }) {
  return null;
}
