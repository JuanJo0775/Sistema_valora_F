import { formatCop } from '../../shared/money';
import { shortDay } from './planDates';
import type { LineDiff } from './savedPlan';
import type { PriceUpdate } from './usePriceUpdate';

const withDay = (cop: number, iso: string | null) => {
  const day = iso ? shortDay(iso) : null;
  return day ? `${formatCop(cop)} (${day})` : formatCop(cop);
};

// Una línea del plan, con texto (nunca solo color): antes y ahora en la misma tienda.
function lineText(d: LineDiff): string {
  const who = `${d.productName} · ${d.storeName}:`;
  if (d.kind === 'gone') return `${who} ya no tiene precio vigente en esta tienda`;
  if (d.kind === 'same' || !d.now) return `${who} sin cambios`;
  const way = d.kind === 'up' ? 'subió' : 'bajó';
  return `${who} antes ${withDay(d.beforeCop, d.beforeAt)} → ahora ${withDay(d.now.priceCop, d.now.observedAt)}, ${way}`;
}

export function PriceUpdatePanel({
  state,
  notice,
  onSave,
  onDiscard,
  onRetry,
}: {
  state: PriceUpdate;
  // Lo que pasó al guardar, para que quede en la misma zona que se anuncia.
  notice: string | null;
  onSave: (diffs: LineDiff[]) => void;
  onDiscard: () => void;
  onRetry: () => void;
}) {
  const diffs = state.status === 'ready' ? state.diffs : [];
  const changed = diffs.filter((d) => d.kind === 'up' || d.kind === 'down').length;
  return (
    <div className="price-update no-print">
      <div role="status">
        {notice && <p>{notice}</p>}
        {state.status === 'loading' && <p>Buscando precios de hoy…</p>}
        {state.status === 'denied' && <p>No pudimos obtener tu ubicación; arma el plan de nuevo</p>}
        {state.status === 'failed' && (
          <p>No pudimos consultar los precios. Revisa tu conexión e inténtalo de nuevo.</p>
        )}
        {state.status === 'ready' && diffs.length === 0 && (
          <p>Este plan no tiene productos con precio para actualizar.</p>
        )}
        {diffs.length > 0 && (
          <>
            <p>
              {changed === 0
                ? 'Los precios siguen igual que cuando guardaste el plan.'
                : `Cambiaron ${String(changed)} ${changed === 1 ? 'precio' : 'precios'}. Revisa antes de guardar.`}
            </p>
            <ul className="plan-lines">
              {diffs.map((d) => (
                <li key={d.presentationId}>
                  <span>
                    <span>{lineText(d)}</span>
                    {d.cheaper && (
                      <>
                        <br />
                        <span className="muted">{`${d.cheaper.storeName} la tiene más barata: ${formatCop(d.cheaper.priceCop)}`}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {state.status === 'failed' && (
        <button type="button" className="btn" onClick={onRetry}>
          Reintentar
        </button>
      )}
      {state.status === 'ready' && diffs.length > 0 && (
        <div className="actions">
          {changed > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                onSave(diffs);
              }}
            >
              Guardar con precios nuevos
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onDiscard}>
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}
