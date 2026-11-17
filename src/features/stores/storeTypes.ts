import type { components } from '../../shared/api/schema';

type StoreType = components['schemas']['Establishment']['type'];

export const STORE_TYPES: Record<StoreType, string> = {
  barrio: 'Tienda de barrio',
  minimercado: 'Minimercado',
  supermercado: 'Supermercado',
  descuento: 'Descuento',
};
