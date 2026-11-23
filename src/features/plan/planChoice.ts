import type { Area } from '../basket/useStoreTotals';
import type { BasketLine } from '../basket/totals';
import type { SplitOption } from './split';
import type { ShownTravel, TravelAssumptions } from './travel';

// Lo que deja listo «Dónde comprar» para guardar la recomendación elegida: el reparto, los supuestos
// y las cifras ya calculadas. La ubicación de la persona no viaja aquí (EC-08).
export interface PlanChoice {
  option: SplitOption;
  area: Area;
  lines: BasketLine[];
  assumptions: TravelAssumptions;
  // Tarifa escrita por tienda que va a domicilio (null si va a domicilio sin tarifa).
  deliveryByStore: Record<string, number | null>;
  summary: {
    productsCop: number;
    savingsCop: number | null;
    travel: ShownTravel | null;
    deliveryCop: number;
    netCop: number | null;
  };
}
