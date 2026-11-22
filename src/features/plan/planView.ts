import { useState } from 'react';
import type { Point } from '../../shared/location';
import type { BasketItem } from '../basket/basketContext';
import type { BasketLine } from '../basket/totals';
import { readAssumptions, saveAssumptions } from './assumptions';
import type { Delivery } from './PlanStoreSection';
import { bestSplits, type SplitOption } from './split';
import {
  extraTravel,
  netEstimate,
  routeEstimate,
  shownTravel,
  type ShownTravel,
  type TravelAssumptions,
  type TravelEstimate,
} from './travel';

// Lo que cuenta cada opción del reparto (1, 2 o 3 tiendas), ya calculado: el plan de compra y
// «Dónde comprar», en la canasta, lo dibujan igual con `OptionCard`.
export interface OptionView {
  option: SplitOption;
  // Cuántos productos cubre el reparto y de cuántos de la canasta.
  covered: number;
  total: number;
  route: TravelEstimate;
  shown: ShownTravel;
  savingsCop: number | null;
  netCop: number | null;
  deliveryCop: number;
  hasDelivery: boolean;
  hasFee: boolean;
  baselineName: string | undefined;
  // Tarifa escrita por tienda que va a domicilio (null si va a domicilio sin tarifa).
  deliveryByStore: Record<string, number | null>;
}

export interface PlanSettings {
  assumptions: TravelAssumptions;
  choose: (next: TravelAssumptions) => void;
  deliveryOf: (id: string) => Delivery;
  setDelivery: (id: string, next: Delivery) => void;
}

// Lo que escribe la persona como tarifa: vacío o inválido es «sin tarifa».
const feeOf = ({ fee }: Delivery): number | null => {
  if (fee.trim() === '') return null;
  const value = Number(fee);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const point = ({ lat, lng }: Point): Point => ({ lat, lng });

// Los supuestos del traslado (que se recuerdan) y el domicilio de cada tienda (que no). Quien los
// guarda debe seguir montado al cambiar de opción, para no perder lo escrito.
export function usePlanSettings(): PlanSettings {
  const [assumptions, setAssumptions] = useState(readAssumptions);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery>>({});
  return {
    assumptions,
    choose: (next) => {
      setAssumptions(next);
      saveAssumptions(next);
    },
    deliveryOf: (id) => deliveries[id] ?? { on: false, fee: '' },
    setDelivery: (id, next) => {
      setDeliveries((all) => ({ ...all, [id]: next }));
    },
  };
}

// El reparto de la canasta pendiente con las cuentas del traslado y del domicilio de cada opción.
export function planOf(
  pending: BasketItem[],
  lines: BasketLine[],
  origin: Point | null,
  { assumptions, deliveryOf }: Pick<PlanSettings, 'assumptions' | 'deliveryOf'>,
) {
  const { options, unpriced } = bestSplits(lines, 3);
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

  const view = (option: SplitOption): OptionView => {
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
    return {
      option,
      covered: option.shares.reduce((sum, { lines: shared }) => sum + shared.length, 0),
      total: pending.length,
      route,
      shown,
      savingsCop,
      netCop,
      deliveryCop,
      hasDelivery: option.shares.some(({ store }) => deliveryOf(store.id).on),
      hasFee: fees.some((fee) => fee !== undefined && fee !== null),
      baselineName: baselineStore?.name,
      deliveryByStore,
    };
  };

  return { options, names, unpricedItems, view };
}
