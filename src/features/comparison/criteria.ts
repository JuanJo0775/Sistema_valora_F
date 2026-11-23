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

export const MUNICIPALITY_CENTERS: Record<Municipality, [number, number]> = {
  armenia: [4.5339, -75.6811],
  buenavista: [4.3608, -75.7395],
  calarca: [4.5196, -75.6436],
  circasia: [4.6188, -75.6358],
  cordoba: [4.3915, -75.6876],
  filandia: [4.6747, -75.6583],
  genova: [4.2071, -75.7898],
  'la-tebaida': [4.4525, -75.7881],
  montenegro: [4.5664, -75.7509],
  pijao: [4.3338, -75.7045],
  quimbaya: [4.6232, -75.7626],
  salento: [4.6377, -75.5706],
};

// Para elegir el municipio (comparación, mapa y propuestas de tienda).
export const MUNICIPALITY_OPTIONS = (Object.keys(MUNICIPALITIES) as Municipality[]).map(
  (value) => ({
    value,
    label: MUNICIPALITIES[value],
  }),
);

const SORTS: Record<Criteria['sort'], string> = {
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
