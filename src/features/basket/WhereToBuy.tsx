import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Loading } from '../../shared/ui/Loading';
import { MUNICIPALITIES } from '../comparison/criteria';
import type { Where } from '../comparison/useWhere';
import { WherePicker } from '../comparison/WherePicker';
import { AssumptionsForm } from '../plan/AssumptionsForm';
import { nearbyTotals, withDistance } from '../plan/nearby';
import { OptionCard } from '../plan/OptionCard';
import { planOf, usePlanSettings } from '../plan/planView';
import { recommend } from '../plan/recommend';
import type { BasketItem } from './basketContext';
import { CheapestStore } from './CheapestStore';
import { noticeText, RecommendationCards } from './RecommendationCards';
import type { StoreTotals } from './useStoreTotals';
import '../plan/plan.css';
import './whereToBuy.css';

// «Dónde comprar», en la canasta: el sistema calcula recomendaciones y la persona elige una. Las
// ofertas llegan de una consulta por municipio (la misma para todos, ADR-031); la cercanía se calcula
// aquí, en el dispositivo, así que cambiar el radio o de tarjeta no pide nada a la red. Guardar el
// plan sigue en /canasta/plan.
export function WhereToBuy({
  where,
  municipality,
  totals,
  items,
}: {
  where: Where;
  municipality: Parameters<typeof CheapestStore>[0]['municipality'];
  // Las cuentas del municipio completo (sin recortar por radio).
  totals: StoreTotals;
  // Lo que falta comprar.
  items: BasketItem[];
}) {
  const [picked, setPicked] = useState<string>();
  // Los supuestos y los domicilios viven aquí, no en la tarjeta: cambiar de tarjeta no los pierde.
  const settings = usePlanSettings();
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
  if (where.ready && totals.status === 'empty') return null;

  return (
    <aside className="side where-buy" aria-label="Dónde comprar">
      <div className="where-buy-head">
        <h2>Dónde comprar</h2>
        <WherePicker where={where} />
      </div>
      {!where.ready || totals.status === 'loading' ? (
        <Loading text={where.ready ? 'Buscando precios…' : 'Buscando tu ubicación…'} />
      ) : totals.status === 'failed' ? (
        <p className="muted">No pudimos calcular dónde te sale más barata.</p>
      ) : (
        found &&
        located && (
          <Recommended
            found={found}
            where={where}
            municipality={municipality}
            totals={totals}
            items={items}
            lines={located}
            selectedId={picked}
            onSelect={setPicked}
            settings={settings}
          />
        )
      )}
      {where.ready && totals.status === 'ready' && (
        <Link to="/canasta/plan" className="btn ghost">
          Ver el plan completo y guardarlo
        </Link>
      )}
    </aside>
  );
}

function Recommended({
  found,
  where,
  municipality,
  totals,
  items,
  lines,
  selectedId,
  onSelect,
  settings,
}: {
  found: ReturnType<typeof recommend>;
  where: Where;
  municipality: Parameters<typeof CheapestStore>[0]['municipality'];
  totals: StoreTotals;
  items: BasketItem[];
  lines: Parameters<typeof planOf>[1];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  settings: ReturnType<typeof usePlanSettings>;
}) {
  const { items: recs, notices } = found;
  const { names, unpricedItems, view } = planOf(items, lines, where.point, settings);
  const selected = recs.find(({ id }) => id === selectedId) ?? recs[0];
  // La tarjeta naranja de siempre, para la mejor tienda única del área que se está viendo.
  const area = nearbyTotals(totals, where.point, where.radiusKm);
  const bestId = area.status === 'ready' ? area.best?.store.id : undefined;
  const sole = selected?.option.stores === 1 ? selected.option.shares[0]?.store.id : undefined;
  // Si ninguna tienda tiene todo no se muestra: el aviso del panel ya lo dice.
  const showCheapest = area.status === 'ready' && sole !== undefined && sole === bestId;
  return (
    <>
      {notices.map((notice) => (
        <p key={notice.type} role="status" className="muted">
          {noticeText(notice)}
        </p>
      ))}
      {unpricedItems.length > 0 && (
        <p role="status" className="banner warn">
          {`Sin precio vigente cerca: ${unpricedItems.map(({ productName }) => productName).join(', ')}. No cuentan en los totales.`}
        </p>
      )}
      {!selected ? (
        <p className="muted">Ningún producto de tu canasta tiene precio vigente en esta zona.</p>
      ) : (
        <>
          <RecommendationCards
            items={recs}
            selectedId={selected.id}
            onSelect={onSelect}
            municipality={MUNICIPALITIES[municipality]}
            located={where.point !== null}
          />
          {showCheapest && (
            <CheapestStore municipality={municipality} totals={area} items={items} />
          )}
          <OptionCard
            view={view(selected.option)}
            names={names}
            origin={where.point}
            assumptions={settings.assumptions}
            deliveryOf={settings.deliveryOf}
            onDelivery={settings.setDelivery}
            panel
            hideTotal
            quietSingle
          />
          <AssumptionsForm value={settings.assumptions} onChange={settings.choose} />
        </>
      )}
    </>
  );
}
