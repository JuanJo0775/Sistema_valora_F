import { useMemo, useSyncExternalStore } from 'react';
import { plansSnapshot, readPlans, subscribePlans, type SavedPlan } from './savedPlan';

// Las listas guardadas en este navegador, al día: se refresca solas al guardar, renombrar, duplicar o borrar.
export function usePlans(): SavedPlan[] {
  const raw = useSyncExternalStore(subscribePlans, plansSnapshot, () => null);
  // `raw` es la instantánea: mientras no cambie, no se vuelve a leer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readPlans(), [raw]);
}
