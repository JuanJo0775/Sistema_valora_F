import type { components } from '../../shared/api/schema';

type Presentation = Pick<components['schemas']['Presentation'], 'quantity' | 'unit' | 'packCount'>;

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

// Solo cómo se lee; la unidad base y el precio por unidad los calcula el backend (RF-004).
export function formatPresentation({ quantity, unit, packCount }: Presentation): string {
  const size = `${number.format(quantity)} ${unit}`;
  return packCount > 1 ? `${String(packCount)} × ${size}` : size;
}
