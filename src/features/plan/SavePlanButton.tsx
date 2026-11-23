import { useState } from 'react';
import { Link } from 'react-router';
import { type BasketItem, useBasket } from '../basket/basketContext';
import type { PlanChoice } from './PlanPage';
import type { Area } from '../basket/useStoreTotals';
import { MAX_PLANS, savePlanOnce, toSavedPlan, type PlanDraft, type SavedLine } from './savedPlan';

type Result = 'saved' | 'same' | 'full' | 'failed';

// El área de búsqueda como la lleva el borrador. Las coordenadas de la persona viajan en memoria;
// toSavedPlan las descarta.
export const areaOf = (area: Area): PlanDraft['area'] =>
  'municipality' in area
    ? { kind: 'municipio', municipality: area.municipality }
    : { kind: 'ubicacion', radiusKm: area.radiusKm, lat: area.lat, lng: area.lng };

// Un producto de la canasta sin precio ni tienda: así se guarda solo la lista.
export const unpricedLine = (item: BasketItem): Omit<SavedLine, 'bought'> => ({
  productId: item.productId,
  productName: item.productName,
  presentationId: item.presentationId,
  presentationLabel: item.presentationLabel,
  quantity: item.quantity,
  storeId: null,
  priceCop: null,
  source: 'comunidad',
  freshness: 'vigente',
  observedAt: null,
});

// Arma lo que se guarda: una línea por producto pendiente y solo las tiendas del reparto.
export function draftOf(choice: PlanChoice, pending: BasketItem[]): PlanDraft {
  const { option, area, lines, summary, assumptions, deliveryByStore } = choice;
  const stores = option.shares.map(({ store }): PlanDraft['stores'][number] => {
    const fee = deliveryByStore[store.id];
    return {
      id: store.id,
      name: store.name,
      type: store.type,
      ...(store.address === undefined ? {} : { address: store.address }),
      lat: store.lat,
      lng: store.lng,
      municipality: store.municipality,
      delivery: typeof fee === 'number' ? { feeCop: fee } : null,
    };
  });
  let missing = 0;
  const saved = pending.map((item): Omit<SavedLine, 'bought'> => {
    const share = option.shares.find((s) =>
      s.lines.some(({ presentationId }) => presentationId === item.presentationId),
    );
    const assigned = share?.lines.find(
      ({ presentationId }) => presentationId === item.presentationId,
    );
    // source, freshness y observedAt salen de la oferta de esa tienda, no del reparto.
    const offer = share
      ? lines
          .find(({ presentationId }) => presentationId === item.presentationId)
          ?.offers.find(
            (o) =>
              o.presentationId === item.presentationId && o.establishment.id === share.store.id,
          )
      : undefined;
    if (!share || !assigned || !offer) {
      missing += 1;
      return unpricedLine(item);
    }
    return {
      ...unpricedLine(item),
      storeId: share.store.id,
      priceCop: assigned.unitCop,
      source: offer.source,
      freshness: offer.freshness,
      observedAt: offer.observedAt,
    };
  });
  return {
    area: areaOf(area),
    stores,
    lines: saved,
    summary: {
      stores: option.stores,
      productsCop: summary.productsCop,
      baselineCop: summary.savingsCop === null ? null : summary.productsCop + summary.savingsCop,
      travel: summary.travel
        ? {
            extraKm: summary.travel.km,
            extra: summary.travel.kind !== 'total',
            ...(summary.travel.kind === 'menos' ? { less: true } : {}),
            minutes: summary.travel.minutes,
            costCop: summary.travel.costCop,
            assumptions,
          }
        : null,
      deliveryCop: summary.deliveryCop,
      netCop: summary.netCop,
      missing,
    },
  };
}

export function SavePlanButton({
  choice,
  onSaved,
}: {
  choice: PlanChoice;
  // Para que la lista «Mis planes» se refresque.
  onSaved?: () => void;
}) {
  const { items } = useBasket();
  const [result, setResult] = useState<Result | null>(null);
  const [id, setId] = useState('');

  const save = () => {
    const pending = items.filter(({ bought }) => !bought);
    const plan = toSavedPlan(draftOf(choice, pending), new Date());
    const { outcome, id: savedId } = savePlanOnce(plan);
    setId(savedId);
    setResult(outcome);
    if (outcome === 'saved' || outcome === 'same') onSaved?.();
  };

  return (
    <div className="plan-save no-print">
      <button type="button" className="btn" onClick={save}>
        Guardar plan
      </button>
      <div role="status" className="plan-save-result">
        {(result === 'saved' || result === 'same') && (
          <p>
            <span>{result === 'saved' ? 'Plan guardado' : 'Este plan ya estaba guardado'}</span>{' '}
            <Link to={`/canasta/plan/${id}`}>Ver plan guardado</Link>
          </p>
        )}
        {result === 'full' && (
          <p>
            Ya tienes {String(MAX_PLANS)} planes guardados. Borra uno para guardar otro.{' '}
            <Link to="/canasta/plan#mis-planes">Ver mis planes</Link>
          </p>
        )}
        {result === 'failed' && (
          <p>
            No se pudo guardar en este navegador (modo privado o sin espacio). Puedes compartirlo o
            imprimirlo.
          </p>
        )}
      </div>
    </div>
  );
}
