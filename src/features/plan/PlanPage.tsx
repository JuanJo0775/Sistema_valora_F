import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import type { Point } from '../../shared/location';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { useWide } from '../../shared/useWide';
import { type BasketItem, useBasket } from '../basket/basketContext';
import { type Area, useStoreTotals } from '../basket/useStoreTotals';
import type { BasketLine } from '../basket/totals';
import { useWhere } from '../comparison/useWhere';
import { WherePicker } from '../comparison/WherePicker';
import { AssumptionsForm } from './AssumptionsForm';
import { OptionCard } from './OptionCard';
import { planOf, usePlanSettings } from './planView';
import { SavePlanButton } from './SavePlanButton';
import { SavedPlansList } from './SavedPlansList';
import type { SplitOption } from './split';
import type { ShownTravel, TravelAssumptions } from './travel';
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
  const wide = useWide();
  // En computador, los supuestos (que dibuja PlanContent, dueño de su estado) y los planes guardados
  // van en el panel lateral; en tableta y celular, en línea y en el orden de siempre (DOM = visual).
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const saved = <SavedPlansList key={savedCount} />;
  if (pending.length === 0) {
    return (
      <section className="plan">
        <h1>Plan de compra</h1>
        <EmptyState
          title="Tu canasta está vacía"
          text="Agrega productos desde su página para armar tu plan de compra."
          action={
            <Link to="/" className="btn">
              Buscar productos
            </Link>
          }
        />
        {saved}
      </section>
    );
  }
  return (
    <div className="with-side plan-layout">
      <section className="plan">
        <h1>Plan de compra</h1>
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
            wide={wide}
            assumptionsSlot={slot}
          />
        ) : (
          <Loading text="Buscando tu ubicación…" />
        )}
        {!wide && saved}
      </section>
      {wide && (
        <aside className="side plan-side" aria-label="Supuestos del traslado y planes guardados">
          <div ref={setSlot} className="plan-slot" />
          {saved}
        </aside>
      )}
    </div>
  );
}

function PlanContent({
  pending,
  area,
  origin,
  renderAction,
  wide,
  assumptionsSlot,
}: {
  pending: BasketItem[];
  area: Area;
  origin: Point | null;
  renderAction?: (choice: PlanChoice) => ReactNode;
  // En computador el formulario de supuestos va al panel lateral; si no, en línea.
  wide: boolean;
  assumptionsSlot: HTMLElement | null;
}) {
  const { totals } = useStoreTotals(pending, area);
  const settings = usePlanSettings();
  const { assumptions, choose, deliveryOf, setDelivery } = settings;

  if (totals.status === 'loading') return <Loading text="Buscando precios…" />;
  if (totals.status === 'failed') {
    return <ErrorState error={null} />;
  }
  if (totals.status === 'empty') return null;

  const { options, names, unpricedItems, view } = planOf(pending, totals.lines, origin, settings);
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

  const render = (option: SplitOption) => {
    const shown = view(option);
    return (
      <OptionCard
        key={option.stores}
        view={shown}
        names={names}
        origin={origin}
        assumptions={assumptions}
        deliveryOf={deliveryOf}
        onDelivery={setDelivery}
        action={renderAction?.({
          option,
          area,
          lines: totals.lines,
          assumptions,
          deliveryByStore: shown.deliveryByStore,
          summary: {
            productsCop: option.productsCop,
            savingsCop: shown.savingsCop,
            travel: origin ? shown.shown : null,
            deliveryCop: shown.deliveryCop,
            netCop: shown.netCop,
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
      {wide ? (
        assumptionsSlot &&
        createPortal(<AssumptionsForm value={assumptions} onChange={choose} />, assumptionsSlot)
      ) : (
        <AssumptionsForm value={assumptions} onChange={choose} />
      )}
      <div className="plan-options">
        {upToTwo.map(render)}
        {three && (
          <details className="plan-more">
            <summary>Probar con 3 tiendas</summary>
            {render(three)}
          </details>
        )}
      </div>
    </>
  );
}
