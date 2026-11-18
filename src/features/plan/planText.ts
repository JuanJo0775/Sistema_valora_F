import { directionsTo } from '../../shared/directions';
import type { SavedPlan } from './savedPlan';

// Texto del plan para compartir o descargar. Puro y sin formato: se lee igual en WhatsApp o en un
// .txt. Solo lleva datos de las tiendas; nunca la ubicación de la persona ni distanceM.
const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
const KM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

const cop = (n: number) => COP.format(n).replace(/\s/g, ' ');

// «17-nov» según el día en Colombia (no el de la máquina ni el de UTC).
const DATE = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Bogota',
});
function shortDate(iso: string | null): string | null {
  if (iso === null) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const part = (type: string) =>
    DATE.formatToParts(d)
      .find((p) => p.type === type)
      ?.value.replace('.', '');
  return `${part('day') ?? ''}-${part('month') ?? ''}`;
}

type SavedTravel = NonNullable<SavedPlan['summary']['travel']>;
// Rótulo y calificativo del traslado guardado: «extra» solo si de verdad es un extra.
export const travelLabel = (t: SavedTravel) =>
  t.extra && t.less !== true ? 'Traslado extra (estimado)' : 'Traslado (estimado)';
export const travelQualifier = (t: SavedTravel) =>
  t.less === true ? ' menos que ir a una sola tienda' : t.extra ? ' más' : '';

export const DELIVERY_NOTE =
  'Valora no hace pedidos ni domicilios. La tarifa es la que tú escribiste; confírmala con la tienda.';

export function planToText(plan: SavedPlan): string {
  const out: string[] = ['Plan de compra de Valora'];
  const saved = shortDate(plan.savedAt);
  if (saved) out.push(`Plan guardado el ${saved}. Los precios cambian y vencen: confírmalos.`);

  for (const store of plan.stores) {
    const lines = plan.lines.filter((l) => l.storeId === store.id && l.priceCop !== null);
    out.push('', store.name);
    if (store.address) out.push(store.address);
    out.push(`Cómo llegar: ${directionsTo(store)}`);
    let subtotal = 0;
    for (const l of lines) {
      const price = l.priceCop ?? 0;
      subtotal += price * l.quantity;
      const date = shortDate(l.observedAt);
      out.push(
        `- ${String(l.quantity)} x ${l.productName} (${l.presentationLabel}): ${cop(price)} c/u` +
          (date ? ` (precio del ${date})` : ''),
      );
    }
    out.push(`Subtotal: ${cop(subtotal)}`);
    if (store.delivery) out.push(`Domicilio (estimado): ${cop(store.delivery.feeCop)}`);
  }

  const missing = plan.lines.filter((l) => l.storeId === null || l.priceCop === null);
  if (missing.length > 0) {
    out.push('', 'Sin precio vigente cerca:');
    for (const l of missing) {
      out.push(`- ${String(l.quantity)} x ${l.productName} (${l.presentationLabel})`);
    }
  }

  const s = plan.summary;
  out.push('', `Total productos: ${cop(s.productsCop)}`);
  if (s.travel) {
    const t = s.travel;
    out.push(
      `${travelLabel(t)}: ${KM.format(t.extraKm)} km${travelQualifier(t)}, ${String(Math.round(t.minutes))} min a pie` +
        (t.costCop === null ? '' : `, ${cop(t.costCop)}`),
    );
  }
  if (s.travel) {
    const a = s.travel.assumptions;
    out.push(
      `Supuestos del traslado (estimado): línea recta × ${KM.format(a.detour)}; ${KM.format(a.kmh)} km/h a pie.`,
    );
  }
  const hasDelivery = plan.stores.some((st) => st.delivery !== null);
  if (hasDelivery) out.push(`Domicilio (estimado): ${cop(s.deliveryCop)}`);
  if (s.netCop !== null) out.push(`Ahorro neto (estimado): ${cop(s.netCop)}`);
  if (hasDelivery) out.push(DELIVERY_NOTE);

  out.push('', 'Precios informativos de Valora, no oficiales');
  return out.join('\n');
}
