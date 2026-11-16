import type { components } from '../../shared/api/schema';

type Presentation = Pick<components['schemas']['Presentation'], 'quantity' | 'unit' | 'packCount'>;

// Solo cómo se lee; la unidad base y el precio por unidad los calcula el backend (RF-004).
export function formatPresentation({ quantity, unit, packCount }: Presentation): string {
  const size = `${String(quantity)} ${unit}`;
  return packCount > 1 ? `${String(packCount)} × ${size}` : size;
}
