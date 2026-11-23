import { useMemo } from 'react';
import { Outlet } from 'react-router';
import { useWhere } from '../comparison/useWhere';
import { withDistance } from '../plan/nearby';
import { usePlanSettings } from '../plan/planView';
import { recommend } from '../plan/recommend';
import { useBasket } from './basketContext';
import { CanastaContext } from './canastaContext';
import { useStoreTotals } from './useStoreTotals';

// Contenedor de «Mi canasta» y «Dónde comprar» (ADR-031: se consulta siempre por municipio, misma
// URL para todos). El estado del área, los supuestos y las ofertas viven aquí, así que cambiar de
// una pantalla a la otra no pierde lo elegido ni hace solicitudes nuevas; la cercanía se calcula
// en el dispositivo con la ubicación en memoria.
export function CanastaScope() {
  const { items } = useBasket();
  const where = useWhere();
  const settings = usePlanSettings();
  const { totals } = useStoreTotals(items, { municipality: where.municipality });
  const lines = totals.status === 'ready' ? totals.lines : undefined;
  const { point, radiusKm } = where;
  const found = useMemo(
    () => (lines ? recommend(lines, point, radiusKm) : undefined),
    [lines, point, radiusKm],
  );
  const located = useMemo(
    () => (lines && point ? withDistance(lines, point) : lines),
    [lines, point],
  );
  const pending = useMemo(() => items.filter(({ bought }) => !bought), [items]);
  return (
    <CanastaContext value={{ where, settings, totals, pending, found, located }}>
      <Outlet />
    </CanastaContext>
  );
}
