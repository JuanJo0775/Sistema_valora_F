import { useBasket } from './basketContext';
import { toBasketItems } from '../plan/savedListView';
import { planName, type SavedPlan } from '../plan/savedPlan';
import type { UseMode } from './UseListButton';

// Usar una lista guardada: reemplaza o suma a «Mi lista» y devuelve el aviso para mostrar.
export function useApplyList() {
  const { replaceAll, addMany } = useBasket();
  return (plan: SavedPlan, mode: UseMode): string => {
    if (mode === 'replace') replaceAll(toBasketItems(plan));
    else addMany(toBasketItems(plan));
    return mode === 'replace'
      ? `Listo: cargamos «${planName(plan)}» en tu canasta`
      : `Listo: agregamos «${planName(plan)}» a tu canasta`;
  };
}
