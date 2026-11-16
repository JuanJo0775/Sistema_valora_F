import type { components } from '../../shared/api/schema';

type Criteria = components['schemas']['Comparison']['criteria'];
export type Municipality = components['schemas']['Municipality'];

export const MUNICIPALITIES: Record<Municipality, string> = {
  armenia: 'Armenia',
  buenavista: 'Buenavista',
  calarca: 'Calarcá',
  circasia: 'Circasia',
  cordoba: 'Córdoba',
  filandia: 'Filandia',
  genova: 'Génova',
  'la-tebaida': 'La Tebaida',
  montenegro: 'Montenegro',
  pijao: 'Pijao',
  quimbaya: 'Quimbaya',
  salento: 'Salento',
};

export const SORTS: Record<Criteria['sort'], string> = {
  unit_price: 'precio por unidad',
  recent: 'los más recientes',
  distance: 'distancia',
};

const KM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

// EC-06: el criterio se dice tal como lo devolvió la API, no como lo pidió la pantalla.
export function describeCriteria({ sort, municipality, radiusKm }: Criteria): string {
  const where = [
    municipality && `en ${MUNICIPALITIES[municipality]}`,
    radiusKm !== undefined && `a menos de ${KM.format(radiusKm)} km de ti`,
  ].filter(Boolean);
  return [`Ordenado por ${SORTS[sort]}`, ...where].join(' · ');
}
