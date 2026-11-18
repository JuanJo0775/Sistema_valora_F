import { useId } from 'react';
import { directionsTo } from '../../shared/directions';
import { formatCop } from '../../shared/money';
import type { StoreShare } from './split';

export interface Delivery {
  on: boolean;
  // Lo que escribe la persona; vacío = sin tarifa conocida.
  fee: string;
}

// Una tienda del plan: dónde está, qué se compra allí y, si la persona quiere, domicilio.
export function PlanStoreSection({
  share,
  travelLabel,
  names,
  delivery,
  onDelivery,
}: {
  share: StoreShare;
  // «a 1,2 km de ti», solo con ubicación.
  travelLabel?: string;
  // Nombre y presentación de cada producto por presentationId.
  names: Map<string, { name: string; label: string }>;
  delivery: Delivery;
  onDelivery: (next: Delivery) => void;
}) {
  const titleId = useId();
  const { store } = share;
  const sub = [store.address, travelLabel].filter(Boolean).join(' · ');
  return (
    <div className="plan-store" role="group" aria-labelledby={titleId}>
      <h3 id={titleId}>{store.name}</h3>
      {sub && <p className="muted">{sub}</p>}
      {share.equivalentStores > 1 && (
        <p className="muted">{`El mismo precio en ${String(share.equivalentStores)} tiendas de esta cadena.`}</p>
      )}
      <ul className="plan-lines">
        {share.lines.map((line) => {
          const product = names.get(line.presentationId);
          return (
            <li key={line.presentationId}>
              <span>
                <strong>{product?.name ?? 'Producto'}</strong>
                {product && <span className="muted">{` ${product.label}`}</span>}
              </span>
              <span>{`${String(line.quantity)} × ${formatCop(line.unitCop)} = ${formatCop(line.lineCop)}`}</span>
            </li>
          );
        })}
      </ul>
      <p className="plan-subtotal">{`Subtotal: ${formatCop(share.subtotalCop)}`}</p>
      <div className="actions">
        <a
          className="btn ghost"
          href={directionsTo(store)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Cómo llegar a ${store.name}`}
        >
          Cómo llegar
        </a>
      </div>
      <label className="check plan-switch">
        <input
          type="checkbox"
          role="switch"
          checked={delivery.on}
          onChange={(event) => {
            onDelivery({ ...delivery, on: event.target.checked });
          }}
        />
        <span>Me lo llevan a casa</span>
      </label>
      {delivery.on && (
        <>
          <label className="field">
            ¿Cuánto cobra el domicilio?
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="500"
              value={delivery.fee}
              onChange={(event) => {
                onDelivery({ ...delivery, fee: event.target.value });
              }}
            />
          </label>
          {delivery.fee.trim() === '' && (
            <p className="muted">Domicilio: sin estimado (escribe la tarifa si la conoces)</p>
          )}
        </>
      )}
    </div>
  );
}
