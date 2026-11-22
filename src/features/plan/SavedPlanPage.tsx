import { useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { directionsTo } from '../../shared/directions';
import { formatCop } from '../../shared/money';
import { EmptyState } from '../../shared/ui/EmptyState';
import { isoDay, shortDay } from './planDates';
import { planToText, travelLabel, travelQualifier } from './planText';
import { PriceUpdatePanel } from './PriceUpdatePanel';
import {
  applyPriceUpdate,
  deletePlan,
  readPlans,
  savePlan,
  toggleBought,
  type LineDiff,
  type SavedPlan,
} from './savedPlan';
import { usePriceUpdate } from './usePriceUpdate';
import './plan.css';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NUM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};
const isOnline = () => navigator.onLine;

// El plan que guardaste, sin pedir nada a la red: solo lee lo guardado en este teléfono.
export function SavedPlanPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const online = useSyncExternalStore(subscribeOnline, isOnline);
  const [plan, setPlan] = useState<SavedPlan | undefined>(() =>
    readPlans().find((p) => p.id === id),
  );
  // Cuándo se abrió la pantalla, para saber si el plan ya venció.
  const [now] = useState(Date.now);
  const [copied, setCopied] = useState<'none' | 'copied' | 'manual'>('none');
  const [notice, setNotice] = useState<string | null>(null);
  const update = usePriceUpdate(plan);

  if (!plan) {
    return (
      <section className="plan">
        <EmptyState
          level={1}
          title="No encontramos este plan"
          text="Puede que lo hayas borrado o que se guardó en otro navegador."
          action={
            <Link to="/canasta" className="btn">
              Volver a mi canasta
            </Link>
          }
        />
      </section>
    );
  }

  const text = planToText(plan);
  // Una fecha inválida no se puede dar por vigente: cuenta como desactualizado.
  const age = now - new Date(plan.summary.pricesUpdatedAt ?? plan.savedAt).getTime();
  const stale = Number.isNaN(age) || age > WEEK_MS;
  const unpriced = plan.lines.filter((l) => l.storeId === null || l.priceCop === null);
  const s = plan.summary;
  const hasDelivery = plan.stores.some((st) => st.delivery !== null);

  const toggle = (presentationId: string) => {
    toggleBought(plan.id, presentationId);
    setPlan(readPlans().find((p) => p.id === plan.id));
  };

  const share = () => {
    if ('share' in navigator) {
      // Si la persona cancela, no pasa nada.
      navigator.share({ title: 'Plan de compra de Valora', text }).catch(() => undefined);
      return;
    }
    const clipboard = (navigator as Partial<Navigator>).clipboard;
    if (clipboard) {
      clipboard.writeText(text).then(
        () => {
          setCopied('copied');
        },
        () => {
          setCopied('manual');
        },
      );
    } else setCopied('manual');
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan-valora-${isoDay(plan.savedAt)}.txt`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const check = () => {
    setNotice(null);
    void update.run();
  };

  const savePrices = (diffs: LineDiff[]) => {
    const outcome = savePlan(applyPriceUpdate(plan, diffs));
    if (outcome === 'saved') {
      setPlan(readPlans().find((p) => p.id === plan.id));
      update.reset();
      setNotice('Precios actualizados');
    } else {
      setNotice(
        'No se pudieron guardar los precios nuevos en este navegador. El plan sigue como estaba.',
      );
    }
  };

  const remove = () => {
    deletePlan(plan.id);
    void navigate('/canasta/plan');
  };

  return (
    <section className="plan saved-plan">
      <h1>Plan de compra guardado</h1>
      <p className="muted">{`Plan guardado el ${shortDay(plan.savedAt) ?? ''}`}</p>
      <div role="status" className="banner warn">
        <p>Los precios cambian y vencen; actualízalo antes de salir.</p>
        {stale && (
          <p>
            <strong>Puede estar desactualizado</strong>
          </p>
        )}
      </div>

      {plan.stores.map((store) => {
        const lines = plan.lines.filter((l) => l.storeId === store.id && l.priceCop !== null);
        const subtotal = lines.reduce((sum, l) => sum + (l.priceCop ?? 0) * l.quantity, 0);
        return (
          <section key={store.id} className="plan-store" aria-labelledby={`t-${store.id}`}>
            <h2 id={`t-${store.id}`}>{store.name}</h2>
            {store.address && <p className="muted">{store.address}</p>}
            <p className="no-print">
              <a href={directionsTo(store)} target="_blank" rel="noreferrer">
                {`Cómo llegar a ${store.name}`}
              </a>
            </p>
            <ul className="plan-lines">
              {lines.map((l) => {
                const day = l.observedAt ? shortDay(l.observedAt) : null;
                return (
                  <li key={l.presentationId}>
                    <span>
                      {`${String(l.quantity)} × ${l.productName}`}
                      <span className="muted">{` ${l.presentationLabel}`}</span>
                      <br />
                      <span className="muted">
                        {`${formatCop(l.priceCop ?? 0)} c/u${day ? ` · Precio del ${day}` : ''}`}
                      </span>
                    </span>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={l.bought}
                        aria-label={`Comprado: ${l.productName}`}
                        onChange={() => {
                          toggle(l.presentationId);
                        }}
                      />
                      <span>Comprado</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="plan-subtotal">{`Subtotal: ${formatCop(subtotal)}`}</p>
            {store.delivery && (
              <p>{`Tarifa de domicilio que escribiste (estimado): ${formatCop(store.delivery.feeCop)}`}</p>
            )}
          </section>
        );
      })}

      {unpriced.length > 0 && (
        <section className="plan-store" aria-labelledby="sin-precio">
          <h2 id="sin-precio">Sin precio vigente cerca</h2>
          <ul className="plan-lines">
            {unpriced.map((l) => (
              <li key={l.presentationId}>
                <span>
                  {`${String(l.quantity)} × `}
                  <span>{l.productName}</span>
                  <span className="muted">{` ${l.presentationLabel}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="plan-travel" aria-labelledby="totales">
        <h2 id="totales">Totales</h2>
        <p className="plan-total">
          <strong>{formatCop(s.productsCop)}</strong> en productos
        </p>
        {s.travel && (
          <>
            <p>{`${travelLabel(s.travel)}: ${NUM.format(s.travel.extraKm)} km${travelQualifier(s.travel)}, ${String(Math.round(s.travel.minutes))} min a pie${
              s.travel.costCop === null ? '' : `, ${formatCop(s.travel.costCop)}`
            }`}</p>
            <p className="muted">{`Supuestos: línea recta × ${NUM.format(s.travel.assumptions.detour)}; ${NUM.format(s.travel.assumptions.kmh)} km/h a pie.`}</p>
          </>
        )}
        {hasDelivery && <p>{`Domicilio (estimado): ${formatCop(s.deliveryCop)}`}</p>}
        {s.netCop !== null && <p>{`Ahorro neto (estimado): ${formatCop(s.netCop)}`}</p>}
        {s.pricesUpdatedAt !== undefined && (
          <p className="muted">
            {`Precios actualizados el ${shortDay(s.pricesUpdatedAt) ?? ''}. `}
            <span>Recalcula el plan para ver el ahorro</span>{' '}
            <Link to="/canasta/plan">Recalcular en el plan de compra</Link>
          </p>
        )}
        {hasDelivery && (
          <p className="muted">
            Valora no hace pedidos ni domicilios. La tarifa es la que tú escribiste; confírmala con
            la tienda.
          </p>
        )}
      </section>

      <div className="actions no-print">
        <button type="button" className="btn" onClick={share}>
          Compartir
        </button>
        <button type="button" className="btn ghost" onClick={download}>
          Descargar
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            window.print();
          }}
        >
          Imprimir
        </button>
      </div>
      <div role="status" className="no-print">
        {copied !== 'none' && (
          <p>
            {copied === 'copied' ? 'Plan copiado. ' : 'No se pudo copiar. '}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en WhatsApp
            </a>
          </p>
        )}
      </div>

      <div className="actions no-print">
        <button
          type="button"
          className="btn"
          disabled={!online || update.state.status === 'loading'}
          aria-describedby={online ? undefined : 'sin-conexion'}
          onClick={check}
        >
          Actualizar precios
        </button>
        {online ? (
          <Link to="/canasta/plan" className="btn ghost">
            Armar de nuevo con precios de hoy
          </Link>
        ) : (
          <>
            <button type="button" className="btn ghost" disabled aria-describedby="sin-conexion">
              Armar de nuevo con precios de hoy
            </button>
            <p id="sin-conexion" className="muted">
              Necesitas conexión para actualizar
            </p>
          </>
        )}
        <button type="button" className="btn ghost" onClick={remove}>
          Borrar este plan
        </button>
      </div>
      <PriceUpdatePanel
        state={update.state}
        notice={notice}
        onSave={savePrices}
        onDiscard={update.reset}
        onRetry={check}
      />
    </section>
  );
}
