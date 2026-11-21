import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatCop } from '../../shared/money';
import { formatDistance, type Point } from '../../shared/location';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { type BasketItem, useBasket } from '../basket/basketContext';
import { type Area, useStoreTotals } from '../basket/useStoreTotals';
import type { BasketLine } from '../basket/totals';
import { useWhere } from '../comparison/useWhere';
import { WherePicker } from '../comparison/WherePicker';
import { AssumptionsForm } from './AssumptionsForm';
import { readAssumptions, saveAssumptions } from './assumptions';
import { type Delivery, PlanStoreSection } from './PlanStoreSection';
import { SavePlanButton } from './SavePlanButton';
import { SavedPlansList } from './SavedPlansList';
import { bestSplits, type SplitOption } from './split';
import {
  extraTravel,
  hasLocation,
  netEstimate,
  routeEstimate,
  shownTravel,
  type ShownTravel,
  type TravelAssumptions,
  type TravelEstimate,
} from './travel';
import './plan.css';

// Lo que deja listo la pantalla para guardar el plan elegido (Task 5): el reparto, los supuestos y
// las cifras ya calculadas. La ubicación de la persona no viaja aquí (EC-08).
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

const KM = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NUM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const km = (value: number) => `${KM.format(value)} km`;

// Lo que escribió la persona como tarifa: vacío o inválido es «sin tarifa».
const feeOf = ({ fee }: Delivery): number | null => {
  if (fee.trim() === '') return null;
  const value = Number(fee);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const travelSentence = (shown: ShownTravel, distance: string, cost: string) =>
  shown.kind === 'menos'
    ? `Traslado estimado: ${distance} menos que ir a una sola tienda (≈ ${String(shown.minutes)} min a pie menos)${cost}`
    : `${shown.kind === 'extra' ? 'Traslado extra estimado' : 'Traslado estimado'}: ${distance} (≈ ${String(shown.minutes)} min a pie)${cost}`;

const point = ({ lat, lng }: Point): Point => ({ lat, lng });

// Nombre del paso 4: la pantalla del plan. Un h2 por opción y un h3 por tienda.
export function PlanPage({
  renderAction,
}: {
  // Para que quien guarda el plan ponga su botón en cada opción (Task 5).
  renderAction?: (choice: PlanChoice) => ReactNode;
}) {
  const { items } = useBasket();
  const where = useWhere();
  // Para que «Mis planes» se actualice al guardar uno.
  const [savedCount, setSavedCount] = useState(0);
  const action =
    renderAction ??
    ((choice: PlanChoice) => (
      <SavePlanButton
        choice={choice}
        onSaved={() => {
          setSavedCount((n) => n + 1);
        }}
      />
    ));
  const pending = items.filter(({ bought }) => !bought);
  return (
    <section className="plan">
      <h1>Plan de compra</h1>
      {pending.length === 0 ? (
        <EmptyState
          title="Tu canasta está vacía"
          text="Agrega productos desde su página para armar tu plan de compra."
          action={
            <Link to="/" className="btn">
              Buscar productos
            </Link>
          }
        />
      ) : (
        <>
          <p className="muted">Repartimos tu canasta entre una, dos o tres tiendas cercanas.</p>
          <div className="plan-where">
            <WherePicker where={where} />
          </div>
          {where.ready ? (
            <PlanContent
              pending={pending}
              area={where.query}
              origin={where.point}
              renderAction={action}
            />
          ) : (
            <Loading text="Buscando tu ubicación…" />
          )}
        </>
      )}
      <SavedPlansList key={savedCount} />
    </section>
  );
}

function PlanContent({
  pending,
  area,
  origin,
  renderAction,
}: {
  pending: BasketItem[];
  area: Area;
  origin: Point | null;
  renderAction?: (choice: PlanChoice) => ReactNode;
}) {
  const { totals } = useStoreTotals(pending, area);
  const [assumptions, setAssumptions] = useState(readAssumptions);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery>>({});

  if (totals.status === 'loading') return <Loading text="Buscando precios…" />;
  if (totals.status === 'failed') {
    return <ErrorState error={null} />;
  }
  if (totals.status === 'empty') return null;

  const { options, unpriced } = bestSplits(totals.lines, 3);
  if (options.length === 0) {
    return (
      <div className="state">
        <h2>Sin precio vigente cerca</h2>
        <p className="muted">Ningún producto de tu canasta tiene precio vigente en esta zona.</p>
        <Link to="/canasta" className="btn">
          Volver a mi canasta
        </Link>
      </div>
    );
  }

  const names = new Map(
    pending.map((item) => [
      item.presentationId,
      { name: item.productName, label: item.presentationLabel },
    ]),
  );
  const unpricedItems = pending.filter(({ presentationId }) => unpriced.includes(presentationId));
  // Baseline del traslado y del ahorro: la mejor tienda única que cubre todo.
  const single = options.find(({ stores, savingsVsBestSingleCop }) => {
    return stores === 1 && savingsVsBestSingleCop !== null;
  });
  const baselineStore = single?.shares[0]?.store;
  const baselineRoute = baselineStore
    ? routeEstimate(origin ? point(origin) : null, [point(baselineStore)], assumptions)
    : null;

  const choose = (next: TravelAssumptions) => {
    setAssumptions(next);
    saveAssumptions(next);
  };
  const deliveryOf = (id: string): Delivery => deliveries[id] ?? { on: false, fee: '' };

  const render = (option: SplitOption) => {
    // Una tienda a domicilio no se visita.
    const visited = option.shares.filter(({ store }) => !deliveryOf(store.id).on);
    const route = routeEstimate(
      origin ? point(origin) : null,
      visited.map(({ store }) => point(store)),
      assumptions,
    );
    const extra = baselineRoute && origin ? extraTravel(route, baselineRoute) : null;
    const shown = shownTravel(option.stores > 1, route, extra);
    const fees = option.shares.map(({ store }) => {
      const d = deliveryOf(store.id);
      return d.on ? feeOf(d) : undefined;
    });
    const deliveryCop = fees.reduce<number>((sum, fee) => sum + (fee ?? 0), 0);
    const { savingsCop, netCop } = netEstimate({
      productsCop: option.productsCop,
      baselineCop: single ? single.productsCop : null,
      travelExtraCop: extra?.costCop ?? null,
      deliveryCop,
    });
    const deliveryByStore: Record<string, number | null> = {};
    option.shares.forEach(({ store }, i) => {
      const fee = fees[i];
      if (fee !== undefined) deliveryByStore[store.id] = fee;
      else if (deliveryOf(store.id).on) deliveryByStore[store.id] = null;
    });
    const covered = option.shares.reduce((sum, { lines }) => sum + lines.length, 0);
    return (
      <OptionCard
        key={option.stores}
        option={option}
        covered={covered}
        total={pending.length}
        names={names}
        origin={origin}
        route={route}
        shown={shown}
        savingsCop={savingsCop}
        netCop={netCop}
        deliveryCop={deliveryCop}
        hasDelivery={option.shares.some(({ store }) => deliveryOf(store.id).on)}
        hasFee={fees.some((fee) => fee !== undefined && fee !== null)}
        baselineName={baselineStore?.name}
        assumptions={assumptions}
        deliveryOf={deliveryOf}
        onDelivery={(id, next) => {
          setDeliveries((all) => ({ ...all, [id]: next }));
        }}
        action={renderAction?.({
          option,
          area,
          lines: totals.lines,
          assumptions,
          deliveryByStore,
          summary: {
            productsCop: option.productsCop,
            savingsCop,
            travel: origin ? shown : null,
            deliveryCop,
            netCop,
          },
        })}
      />
    );
  };

  const upToTwo = options.filter(({ stores }) => stores <= 2);
  const three = options.find(({ stores }) => stores === 3);
  return (
    <>
      <p className="muted">
        Ordenamos por productos que faltan, total, suma de las distancias a las tiendas (si
        compartes tu ubicación) y, al final, identificadores
      </p>
      {unpricedItems.length > 0 && (
        <p role="status" className="banner warn">
          {`Sin precio vigente cerca: ${unpricedItems.map(({ productName }) => productName).join(', ')}. No cuentan en los totales.`}
        </p>
      )}
      <AssumptionsForm value={assumptions} onChange={choose} />
      {upToTwo.map(render)}
      {three && (
        <details className="plan-more">
          <summary>Probar con 3 tiendas</summary>
          {render(three)}
        </details>
      )}
    </>
  );
}

function OptionCard({
  option,
  covered,
  total,
  names,
  origin,
  route,
  shown,
  savingsCop,
  netCop,
  deliveryCop,
  hasDelivery,
  hasFee,
  baselineName,
  assumptions,
  deliveryOf,
  onDelivery,
  action,
}: {
  option: SplitOption;
  covered: number;
  total: number;
  names: Map<string, { name: string; label: string }>;
  origin: Point | null;
  route: TravelEstimate;
  shown: ShownTravel;
  savingsCop: number | null;
  netCop: number | null;
  deliveryCop: number;
  hasDelivery: boolean;
  hasFee: boolean;
  baselineName: string | undefined;
  assumptions: TravelAssumptions;
  deliveryOf: (id: string) => Delivery;
  onDelivery: (id: string, next: Delivery) => void;
  action: ReactNode;
}) {
  const titleId = useId();
  const split = option.stores > 1;
  const cost = (estimate: TravelEstimate) =>
    estimate.costCop === null ? '' : ` · ${formatCop(estimate.costCop)}`;
  // Una tienda que se visita pero no tiene coordenadas válidas queda fuera del traslado.
  const unlocated = option.shares.filter(
    ({ store }) => !deliveryOf(store.id).on && !hasLocation(store),
  ).length;
  const assumed = `Supuestos: línea recta × ${NUM.format(assumptions.detour)}; ${NUM.format(assumptions.kmh)} km/h a pie.`;
  return (
    <section className="plan-option" aria-labelledby={titleId}>
      <h2 id={titleId}>{option.stores === 1 ? '1 tienda' : `${String(option.stores)} tiendas`}</h2>
      <p className="plan-total">
        <strong>{formatCop(option.productsCop)}</strong> en productos
      </p>
      {covered < total && (
        <p className="muted">{`Total de ${String(covered)} de ${String(total)} productos`}</p>
      )}
      {split &&
        (option.savingsVsBestSingleCop === null ? (
          <p className="muted">{`Ninguna tienda sola tiene todo; con ${String(option.stores)} tiendas cubres ${String(covered)} de ${String(total)}.`}</p>
        ) : option.savingsVsBestSingleCop > 0 ? (
          <p>
            <span className="pill ok">{`Ahorras ${formatCop(option.savingsVsBestSingleCop)} frente a comprar todo en ${baselineName ?? 'una tienda'}`}</span>
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
              : `a ${formatDistance(share.store.distanceM)} de ti`
          }
          names={names}
          delivery={deliveryOf(share.store.id)}
          onDelivery={(next) => {
            onDelivery(share.store.id, next);
          }}
        />
      ))}
      <div className="plan-travel">
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
        {hasFee && <p>{`Domicilio estimado: ${formatCop(deliveryCop)} (tarifa que escribiste)`}</p>}
        {hasDelivery && (
          <p className="muted">
            Valora no hace pedidos ni domicilios. La tarifa es la que tú escribiste; confírmala con
            la tienda.
          </p>
        )}
      </div>
      {split && netCop !== null && savingsCop !== null && (
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
      )}
      {action}
    </section>
  );
}
