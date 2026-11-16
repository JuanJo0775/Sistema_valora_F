import type { components } from '../../shared/api/schema';

type Presentation = Pick<components['schemas']['Presentation'], 'quantity' | 'unit' | 'packCount'>;

export function formatPresentation(_presentation: Presentation): string {
  return '';
}
