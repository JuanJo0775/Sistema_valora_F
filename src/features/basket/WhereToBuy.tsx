import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Loading } from '../../shared/ui/Loading';
import type { Where } from '../comparison/useWhere';
import { WherePicker } from '../comparison/WherePicker';
import { AssumptionsForm } from '../plan/AssumptionsForm';
import { OptionCard } from '../plan/OptionCard';
import { planOf, usePlanSettings } from '../plan/planView';
import type { BasketItem } from './basketContext';
import { CheapestStore } from './CheapestStore';
import type { StoreTotals } from './useStoreTotals';
import '../plan/plan.css';
import './whereToBuy.css';

type Count = 1 | 2 | 3;
const COUNTS: Count[] = [1, 2, 3];
const label = (count: Count) => (count === 1 ? '1 tienda' : `${String(count)} tiendas`);

// «Dónde comprar», en la canasta: la mejor tienda única (la tarjeta de siempre) o el reparto en 2 o 3
// tiendas. Las cuentas llegan hechas (useStoreTotals, con el área que eligió la persona): las fichas
// 2 y 3 solo reparten, sin pedir nada más a la red. Guardar el plan sigue en /canasta/plan.
export function WhereToBuy({
  where,
  municipality,
  totals,
  items,
}: {
  where: Where;
  municipality: Parameters<typeof CheapestStore>[0]['municipality'];
  totals: StoreTotals;
  // Lo que falta comprar.
  items: BasketItem[];
}) {
  const [count, setCount] = useState<Count>(1);
  // Los supuestos y los domicilios viven aquí, no en la ficha: cambiar de ficha no los pierde.
  const settings = usePlanSettings();
  if (where.ready && totals.status === 'empty') return null;

  return (
    <aside
      className={count === 1 ? 'side where-buy' : 'side where-buy where-buy-split'}
      aria-label="Dónde comprar"
    >
      <div className="where-buy-head">
        <h2>Dónde comprar</h2>
        <WherePicker where={where} />
      </div>
      <StoreCount value={count} onChange={setCount} />
      {!where.ready ? (
        <Loading text="Buscando tu ubicación…" />
      ) : count === 1 ? (
        <CheapestStore municipality={municipality} totals={totals} items={items} />
      ) : (
        <Split
          count={count}
          totals={totals}
          items={items}
          origin={where.point}
          settings={settings}
        />
      )}
      {where.ready && totals.status === 'ready' && (
        <Link to="/canasta/plan" className="btn ghost">
          Ver el plan completo y guardarlo
        </Link>
      )}
    </aside>
  );
}

// Las fichas «1 tienda | 2 tiendas | 3 tiendas»: radios con el aspecto de fichas (como los del radio
// de búsqueda) y flechas para moverse entre ellas.
function StoreCount({ value, onChange }: { value: Count; onChange: (next: Count) => void }) {
  const name = useId();
  const group = useRef<HTMLFieldSetElement>(null);
  const move = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = (COUNTS.indexOf(value) + step + COUNTS.length) % COUNTS.length;
    const next = COUNTS[index] ?? 1;
    onChange(next);
    group.current?.querySelectorAll('input')[index]?.focus();
  };
  return (
    <fieldset
      ref={group}
      role="radiogroup"
      className="category-chips"
      aria-label="Cuántas tiendas"
      onKeyDown={move}
    >
      {COUNTS.map((count) => (
        <label key={count} className="category-chip">
          <input
            type="radio"
            name={`tiendas-${name}`}
            value={count}
            checked={value === count}
            onChange={() => {
              onChange(count);
            }}
          />
          {label(count)}
        </label>
      ))}
    </fieldset>
  );
}

// El reparto en 2 o 3 tiendas con la misma opción y las mismas cuentas del plan de compra.
function Split({
  count,
  totals,
  items,
  origin,
  settings,
}: {
  count: 2 | 3;
  totals: StoreTotals;
  items: BasketItem[];
  origin: Where['point'];
  settings: ReturnType<typeof usePlanSettings>;
}) {
  if (totals.status === 'loading') return <Loading text="Buscando precios…" />;
  if (totals.status === 'failed') return <p className="muted">No pudimos calcular el reparto.</p>;
  if (totals.status === 'empty') return null;
  const { options, names, unpricedItems, view } = planOf(items, totals.lines, origin, settings);
  const option = options.find(({ stores }) => stores === count);
  return (
    <>
      {unpricedItems.length > 0 && (
        <p role="status" className="banner warn">
          {`Sin precio vigente cerca: ${unpricedItems.map(({ productName }) => productName).join(', ')}. No cuentan en los totales.`}
        </p>
      )}
      {options.length === 0 ? (
        <p className="muted">Ningún producto de tu canasta tiene precio vigente en esta zona.</p>
      ) : !option ? (
        <p className="muted">{`Con ${String(count)} tiendas no hay un reparto distinto de los anteriores.`}</p>
      ) : (
        <OptionCard
          view={view(option)}
          names={names}
          origin={origin}
          assumptions={settings.assumptions}
          deliveryOf={settings.deliveryOf}
          onDelivery={settings.setDelivery}
          fold={
            <AssumptionsForm value={settings.assumptions} onChange={settings.choose} level={3} />
          }
        />
      )}
    </>
  );
}
