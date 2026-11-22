import { useId, type ReactNode } from 'react';
import { formatCop } from '../../shared/money';
import { formatDistance, type Point } from '../../shared/location';
import { AT_STORE_M } from './nearby';
import { type Delivery, PlanStoreSection } from './PlanStoreSection';
import type { OptionView } from './planView';
import {
  hasLocation,
  type ShownTravel,
  type TravelAssumptions,
  type TravelEstimate,
} from './travel';

const KM = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NUM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const km = (value: number) => `${KM.format(value)} km`;

const travelSentence = (shown: ShownTravel, distance: string, cost: string) =>
  shown.kind === 'menos'
    ? `Traslado estimado: ${distance} menos que ir a una sola tienda (≈ ${String(shown.minutes)} min a pie menos)${cost}`
    : `${shown.kind === 'extra' ? 'Traslado extra estimado' : 'Traslado estimado'}: ${distance} (≈ ${String(shown.minutes)} min a pie)${cost}`;

// Una opción del reparto: total, ahorro, cada tienda con su «Cómo llegar», el traslado y el neto.
// Con `fold`, la opción va dentro de un panel (sin título ni caja propia: la ficha ya la nombra) y
// el traslado y los supuestos van plegados en «Traslado y domicilio (estimado)».
export function OptionCard({
  view,
  names,
  origin,
  assumptions,
  deliveryOf,
  onDelivery,
  action,
  fold,
  panel = false,
  hideTotal = false,
  quietSingle = false,
}: {
  view: OptionView;
  names: Map<string, { name: string; label: string }>;
  origin: Point | null;
  assumptions: TravelAssumptions;
  deliveryOf: (id: string) => Delivery;
  onDelivery: (id: string, next: Delivery) => void;
  action?: ReactNode;
  fold?: ReactNode;
  // Dentro de «Dónde comprar»: sin título ni caja propia, con el traslado plegado.
  panel?: boolean;
  // El total ya se dice en otra parte del panel (la tarjeta naranja).
  hideTotal?: boolean;
  // El panel ya explica por qué ninguna tienda sola tiene todo: no se repite aquí.
  quietSingle?: boolean;
}) {
  const titleId = useId();
  const { option, covered, total, route, shown, savingsCop, netCop, deliveryCop } = view;
  const split = option.stores > 1;
  const cost = (estimate: TravelEstimate) =>
    estimate.costCop === null ? '' : ` · ${formatCop(estimate.costCop)}`;
  // Una tienda que se visita pero no tiene coordenadas válidas queda fuera del traslado.
  const unlocated = option.shares.filter(
    ({ store }) => !deliveryOf(store.id).on && !hasLocation(store),
  ).length;
  const assumed = `Cómo estimamos esto: contamos ${NUM.format(assumptions.detour)} veces la distancia en línea recta, caminando a ${NUM.format(assumptions.kmh)} km/h.`;
  const travel = (
    <>
      {origin && <p>{travelSentence(shown, km(shown.km), cost(shown))}</p>}
      {!origin && (
        <>
          {split && route.km > 0 && (
            <p>{`Distancia entre tiendas (estimada): ${km(route.km)} (≈ ${String(route.minutes)} min a pie)${cost(route)}`}</p>
          )}
          <p className="muted">Sin tu ubicación no estimamos el trayecto desde tu casa</p>
        </>
      )}
      {unlocated > 0 && (
        <p className="muted">
          {`No pudimos ubicar ${String(unlocated)} ${unlocated === 1 ? 'tienda' : 'tiendas'}; el traslado no ${unlocated === 1 ? 'la cuenta' : 'las cuenta'}.`}
        </p>
      )}
      <p className="muted">{assumed}</p>
    </>
  );
  const delivery = (
    <>
      {view.hasFee && (
        <p>{`Domicilio estimado: ${formatCop(deliveryCop)} (tarifa que escribiste)`}</p>
      )}
      {view.hasDelivery && (
        <p className="muted">
          Valora no hace pedidos ni domicilios. La tarifa es la que tú escribiste; confírmala con la
          tienda.
        </p>
      )}
    </>
  );
  const body = (
    <>
      {!hideTotal && (
        <p className="plan-total">
          <strong>{formatCop(option.productsCop)}</strong> en productos
        </p>
      )}
      {covered < total && (
        <p className="muted">{`Total de ${String(covered)} de ${String(total)} productos`}</p>
      )}
      {split &&
        (option.savingsVsBestSingleCop === null ? (
          quietSingle ? null : (
            <p className="muted">{`Ninguna tienda sola tiene todo; con ${String(option.stores)} tiendas cubres ${String(covered)} de ${String(total)}.`}</p>
          )
        ) : option.savingsVsBestSingleCop > 0 ? (
          <p>
            <span className="pill ok">{`Ahorras ${formatCop(option.savingsVsBestSingleCop)} frente a comprar todo en ${view.baselineName ?? 'una tienda'}`}</span>
          </p>
        ) : (
          <p className="muted">Comprar todo en una tienda te sale igual o mejor</p>
        ))}
      {option.shares.map((share) => (
        <PlanStoreSection
          key={share.store.id}
          share={share}
          travelLabel={
            share.store.distanceM === undefined
              ? undefined
              : share.store.distanceM < AT_STORE_M
                ? 'a pasos de ti'
                : `a ${formatDistance(share.store.distanceM)} de ti`
          }
          names={names}
          delivery={deliveryOf(share.store.id)}
          onDelivery={(next) => {
            onDelivery(share.store.id, next);
          }}
        />
      ))}
    </>
  );
  const net = split && netCop !== null && savingsCop !== null && (
    <div role="status" className="plan-net">
      <p>
        <strong>
          {netCop > 0
            ? `Neto estimado: ahorras ${formatCop(netCop)}`
            : 'Con estos supuestos, dividir no te conviene'}
        </strong>
      </p>
      {!origin && <p className="muted">Sin tu ubicación, el neto no cuenta el traslado.</p>}
    </div>
  );
  if (panel || fold) {
    return (
      <div className="plan-option">
        {body}
        {(view.hasFee || view.hasDelivery) && <div className="plan-travel">{delivery}</div>}
        {net}
        <details className="plan-fold">
          <summary>Traslado y domicilio (estimado)</summary>
          <div className="plan-travel">{travel}</div>
          {fold}
        </details>
        {action}
      </div>
    );
  }
  return (
    <section className="plan-option" aria-labelledby={titleId}>
      <h2 id={titleId}>{option.stores === 1 ? '1 tienda' : `${String(option.stores)} tiendas`}</h2>
      {body}
      <div className="plan-travel">
        {travel}
        {delivery}
      </div>
      {net}
      {action}
    </section>
  );
}
