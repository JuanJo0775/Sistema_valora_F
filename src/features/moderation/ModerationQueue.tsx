import { useEffect, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { formatCop } from '../../shared/money';
import './moderation.css';

type Item = components['schemas']['ModerationItem'];
export type Reason = Item['reason'];

export const REASONS: Record<Reason, string> = {
  desviacion: 'Muy distinto a la mediana',
  rafaga: 'Muchos reportes seguidos',
  marcado: 'Marcado como dudoso',
  apelacion: 'Apelación',
  discrepancia_oficial: 'Distinto al precio oficial',
  verificacion_comercio: 'Verificación de comercio',
};

// «−73 %»: con el signo menos tipográfico, como se lee.
const deviation = (percent: number) =>
  `${percent < 0 ? '−' : '+'}${String(Math.abs(Math.round(percent)))} %`;

function comparison(item: Item) {
  return [
    `Reportado ${formatCop(item.reportedPriceCop)}`,
    item.medianPriceCop !== undefined &&
      `mediana ${formatCop(item.medianPriceCop)}${item.deviationPercent === undefined ? '' : ` (${deviation(item.deviationPercent)})`}`,
    item.officialPriceCop !== undefined && `oficial ${formatCop(item.officialPriceCop)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// RF-012 y RF-013: la cola de precios en revisión. Nunca dice quién reportó ni quién marcó (EC-08).
export function ModerationQueue() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    void call(api.GET('/moderation/queue')).then(({ items: pending }) => {
      setItems(pending ?? []);
    });
  }, []);

  return (
    <ul className="offers">
      {items.map((item) => (
        <li key={item.id} className="offer">
          <p className="badges">
            <span className="pill warn">{REASONS[item.reason]}</span>
          </p>
          <h2>{item.productName}</h2>
          <p className="muted">{item.establishmentName}</p>
          <p>{comparison(item)}</p>
          {item.reportersCount > 0 && (
            <p className="muted">
              {`Marcado como dudoso por ${String(item.reportersCount)} ${item.reportersCount === 1 ? 'cuenta' : 'cuentas'}`}
            </p>
          )}
          {item.appealNote && (
            <blockquote className="appeal-note">{`«${item.appealNote}»`}</blockquote>
          )}
        </li>
      ))}
    </ul>
  );
}
