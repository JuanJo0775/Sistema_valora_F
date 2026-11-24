import { createContext, useContext } from 'react';
import type { Where } from '../comparison/useWhere';
import type { BasketLine } from './totals';
import type { PlanSettings } from '../plan/planView';
import type { Recommendations } from '../plan/recommend';
import type { BasketItem } from './basketContext';
import type { StoreTotals } from './useStoreTotals';

// Lo que comparten «Mi canasta» y «Dónde comprar»: dónde se busca, los supuestos del traslado, las
// ofertas del municipio y las recomendaciones ya calculadas. Vive en el contenedor de las dos
// pantallas (CanastaScope): al pasar de una a otra no se pierde nada ni se pide nada a la red.
export interface Canasta {
  where: Where;
  settings: PlanSettings;
  // Las cuentas del municipio completo (sin recortar por radio).
  totals: StoreTotals;
  // Lo que falta comprar.
  pending: BasketItem[];
  found: Recommendations | undefined;
  // Las ofertas con la distancia a la persona, si compartió su ubicación.
  located: BasketLine[] | undefined;
}

export const CanastaContext = createContext<Canasta | null>(null);

export function useCanasta(): Canasta {
  const value = useContext(CanastaContext);
  if (!value) throw new Error('useCanasta debe usarse dentro de CanastaScope');
  return value;
}
