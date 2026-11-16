import type { components } from '../../shared/api/schema';

type Per = components['schemas']['ComparisonItem']['unitPrice']['per'];

const PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

// Pesos como se escriben en Colombia: «$2.000», sin centavos.
export const formatCop = (value: number) => `$${PESOS.format(value)}`;

const PER: Record<Per, string> = { '100g': 'por 100 g', '100ml': 'por 100 ml', und: 'por unidad' };

// RF-004: el backend ya normaliza; aquí solo se lee «$400 por 100 g».
export const formatUnitPrice = ({ valueCop, per }: { valueCop: number; per: Per }) =>
  `${formatCop(valueCop)} ${PER[per]}`;
