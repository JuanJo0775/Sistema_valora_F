import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatCop } from '../../shared/money';
import { BackLink } from '../../shared/ui/BackLink';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Loading } from '../../shared/ui/Loading';
import { MUNICIPALITIES } from '../comparison/criteria';
import { WherePicker } from '../comparison/WherePicker';
import { AssumptionsForm } from '../plan/AssumptionsForm';
import { nearbyTotals } from '../plan/nearby';
import { OptionCard } from '../plan/OptionCard';
import { planOf } from '../plan/planView';
import { useCanasta } from './canastaContext';
import { CheapestStore } from './CheapestStore';
import {
  gainSentence,
  labelOf,
  noticeText,
  RecommendationCards,
  RecommendationDetail,
} from './RecommendationCards';
import { SaveList } from './SaveList';
import '../plan/plan.css';
import './whereToBuy.css';

// «Dónde comprar», pantalla propia: el sistema calcula recomendaciones y la persona elige una; se ve
// una a la vez en detalle. Las ofertas llegan de una consulta por municipio (la misma para todos,
// ADR-031); la cercanía se calcula aquí, en el dispositivo, así que cambiar el radio o de opción no
// pide nada a la red. Guardar la lista vive en el lado (computador) o en una barra fija (celular).
export function WherePage() {
  const { where, totals } = useCanasta();
  let state: ReactNode;
  if (totals.status === 'empty') {
    return (
      <div className="with-side where-page">
        <Main picker={false}>
          <EmptyState
            title="No hay nada por comprar"
            text="Agrega productos a tu canasta, o desmarca lo comprado, para ver dónde te sale más barata."
            action={
              <Link to="/canasta" className="btn">
                Ir a mi canasta
              </Link>
            }
          />
        </Main>
      </div>
    );
  }
  if (!where.ready || totals.status === 'loading') {
    state = <Loading text={where.ready ? 'Buscando precios…' : 'Buscando tu ubicación…'} />;
  } else if (totals.status === 'failed') {
    state = <p className="muted">No pudimos calcular dónde te sale más barata.</p>;
  } else {
    return (
      <div className="with-side where-page">
        <Recommended />
      </div>
    );
  }
  return (
    <div className="with-side where-page">
      <Main picker>{state}</Main>
    </div>
  );
}

// La columna principal: volver, el título y dónde se busca.
function Main({ picker, children }: { picker: boolean; children: ReactNode }) {
  const { where } = useCanasta();
  return (
    <section className="where-main">
      <BackLink fallback="/canasta" />
      <div className="where-buy-head">
        <h1>Dónde comprar</h1>
        {picker && <WherePicker where={where} />}
      </div>
      {children}
    </section>
  );
}

function Recommended() {
  const { where, settings, totals, pending, found, located } = useCanasta();
  const [picked, setPicked] = useState<string>();
  if (!found || !located) return null;
  const { items: recs, notices } = found;
  const { names, unpricedItems, view } = planOf(pending, located, where.point, settings);
  const selected = recs.find(({ id }) => id === picked) ?? recs[0];
  const shown = selected && view(selected.option);
  // La tarjeta naranja de siempre, para la mejor tienda única del área que se está viendo.
  const area = nearbyTotals(totals, where.point, where.radiusKm);
  const bestId = area.status === 'ready' ? area.best?.store.id : undefined;
  const sole = selected?.option.stores === 1 ? selected.option.shares[0]?.store.id : undefined;
  // Si ninguna tienda tiene todo no se muestra: el aviso de arriba ya lo dice.
  const showCheapest = area.status === 'ready' && sole !== undefined && sole === bestId;
  const municipality = MUNICIPALITIES[where.municipality];
  const hasPoint = where.point !== null;
  const gain = selected ? gainSentence(selected, hasPoint) : '';

  let side: ReactNode;
  if (!selected || !shown) {
    side = (
      <SaveSide>
        <SaveList area={where.query} items={pending} resultKey="solo" />
      </SaveSide>
    );
  } else {
    side = (
      <SaveSide
        label={labelOf(selected.kinds, municipality)}
        total={formatCop(selected.option.productsCop)}
        gain={gain}
      >
        <SaveList
          choice={{
            option: selected.option,
            area: where.query,
            lines: located,
            assumptions: settings.assumptions,
            deliveryByStore: shown.deliveryByStore,
            summary: {
              productsCop: selected.option.productsCop,
              savingsCop: shown.savingsCop,
              travel: hasPoint ? shown.shown : null,
              deliveryCop: shown.deliveryCop,
              netCop: shown.netCop,
            },
          }}
          area={where.query}
          items={pending}
          resultKey={selected.id}
        />
      </SaveSide>
    );
  }

  return (
    <>
      <Main picker>
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
        {!selected || !shown ? (
          <p className="muted">Ningún producto de tu canasta tiene precio vigente en esta zona.</p>
        ) : (
          <div className="where-buy">
            <RecommendationCards
              items={recs}
              selectedId={selected.id}
              onSelect={setPicked}
              municipality={municipality}
            />
            <RecommendationDetail rec={selected} located={hasPoint} />
            {showCheapest && (
              <CheapestStore municipality={where.municipality} totals={area} items={pending} />
            )}
            <OptionCard
              view={shown}
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
          </div>
        )}
      </Main>
      {side}
    </>
  );
}

// Guardar la lista: en computador, un bloque corto a la derecha (con el total y el ahorro); en
// celular, una barra fija abajo, sobre la de navegación (el total ya está en la recomendación).
function SaveSide({
  label,
  total,
  gain,
  children,
}: {
  label?: string;
  total?: string;
  gain?: string;
  children: ReactNode;
}) {
  return (
    <aside className="side fit where-save" aria-label="Guardar lista">
      {label && total && (
        <div className="where-sum">
          <p className="rec-label">{label}</p>
          <p className="where-sum-total">
            <strong>{total}</strong>
            <span className="muted"> en productos</span>
          </p>
          {gain && <p>{gain}</p>}
        </div>
      )}
      {children}
    </aside>
  );
}
