import { useId, useRef, type KeyboardEvent } from 'react';
import { formatDistance } from '../../shared/location';
import { formatCop } from '../../shared/money';
import { radiusLabel } from '../comparison/radius';
import { DEFAULT_ASSUMPTIONS } from '../plan/travel';
import type { Kind, Notice, Recommendation } from '../plan/recommend';

const KM = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const km = (value: number) => `${KM.format(value)} km`;
const walk = (minutes: number) => `≈ ${String(minutes)} min a pie`;
// Minutos a pie de una distancia en línea recta, con los supuestos fijos (rodeo y velocidad).
const walkMin = (meters: number) =>
  Math.round(((meters / 1000) * DEFAULT_ASSUMPTIONS.detour * 60) / DEFAULT_ASSUMPTIONS.kmh);

// Por debajo de esto, «a 0 m» no dice nada: la persona está en la tienda.
const NEAR_M = 30;

const LABELS: Record<Kind, (municipality: string) => string> = {
  cheapest: () => 'La más barata',
  single: () => 'Todo en una tienda',
  nearest: () => 'La más cercana',
  cheapestAll: (municipality) => `La más barata en ${municipality}`,
};

// «La más barata y la más cercana»: las etiquetas de una recomendación fusionada.
export const labelOf = (kinds: Kind[], municipality: string) =>
  kinds
    .map((kind, i) => {
      const text = LABELS[kind](municipality);
      return i === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1);
    })
    .join(' y ');

// La frase de lo que se gana y lo que se paga. Solo precio y distancia (EC-06).
export function gainSentence(rec: Recommendation, located: boolean): string {
  const { extraCop, extraKm, extraMin } = rec;
  const farther =
    located && extraKm !== null && extraKm > 0.05
      ? `, pero son ${km(extraKm)} más (${walk(extraMin ?? 0)})`
      : '';
  if (extraCop === null) return '';
  if (rec.against === 'single') {
    return extraCop < 0 ? `Ahorras ${formatCop(-extraCop)}${farther}.` : '';
  }
  if (extraCop < 0) {
    const away =
      located && extraKm !== null && extraKm > 0.05
        ? `, pero queda ${km(extraKm)} más lejos (${walk(extraMin ?? 0)})`
        : '';
    return `Ahorras ${formatCop(-extraCop)} frente a lo más barato cerca de ti${away}.`;
  }
  const where = rec.kinds.includes('nearest') ? firstDistance(rec) : '';
  if (extraCop === 0) return '';
  const single = rec.option.stores === 1 ? where || 'compras en un solo lugar' : '';
  return `Cuesta ${formatCop(extraCop)} más${single && `, pero ${single}`}.`;
}

const firstDistance = (rec: Recommendation) => {
  const meters = rec.option.shares[0]?.store.distanceM;
  if (meters === undefined) return '';
  return meters < NEAR_M ? 'está a pasos de ti' : `está a ${formatDistance(meters)}`;
};

// Lo que dicen las tarjetas de dos o tres tiendas: no hace falta explicar parámetros.
const spread = (rec: Recommendation) => {
  const count = rec.option.stores === 2 ? 'dos' : 'tres';
  const has =
    rec.covered === rec.total
      ? 'todos tus productos'
      : `${String(rec.covered)} de ${String(rec.total)} productos`;
  return `Estas ${count} tiendas tienen ${has}, pero están separadas por ${km(rec.betweenKm)} (${walk(rec.betweenMin)}). Tú decides si te desplazas.`;
};

export function noticeText(notice: Notice): string {
  switch (notice.type) {
    case 'shareLocation':
      return 'Comparte tu ubicación para ver la más cercana.';
    case 'noneInRadius':
      return `No hay tiendas con tu lista a ${radiusLabel(notice.radiusKm)}; te mostramos las del municipio.`;
    case 'noneComplete':
      return `Ninguna tienda tiene todos tus productos. Te proponemos la combinación que más cubre: ${String(notice.covered)} de ${String(notice.total)}.`;
  }
}

// Las recomendaciones como tarjetas seleccionables: un grupo de radios con el aspecto de tarjeta y
// flechas para moverse (como las fichas del radio de búsqueda).
export function RecommendationCards({
  items,
  selectedId,
  onSelect,
  municipality,
  located,
}: {
  items: Recommendation[];
  selectedId: string;
  onSelect: (id: string) => void;
  municipality: string;
  located: boolean;
}) {
  const name = useId();
  const group = useRef<HTMLFieldSetElement>(null);
  const move = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const current = Math.max(
      0,
      items.findIndex(({ id }) => id === selectedId),
    );
    const index = (current + step + items.length) % items.length;
    const next = items[index];
    if (next) onSelect(next.id);
    group.current?.querySelectorAll('input')[index]?.focus();
  };
  return (
    <fieldset
      ref={group}
      role="radiogroup"
      className="rec-cards"
      aria-label="Recomendaciones"
      onKeyDown={move}
    >
      {items.map((rec) => (
        <Card
          key={rec.id}
          rec={rec}
          group={name}
          checked={rec.id === selectedId}
          onSelect={onSelect}
          municipality={municipality}
          located={located}
        />
      ))}
    </fieldset>
  );
}

function Card({
  rec,
  group,
  checked,
  onSelect,
  municipality,
  located,
}: {
  rec: Recommendation;
  group: string;
  checked: boolean;
  onSelect: (id: string) => void;
  municipality: string;
  located: boolean;
}) {
  const id = useId();
  const gain = gainSentence(rec, located);
  return (
    <label className="rec-card">
      <input
        type="radio"
        name={`recomendacion-${group}`}
        checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-body`}
        onChange={() => {
          onSelect(rec.id);
        }}
      />
      <span id={`${id}-label`} className="rec-label">
        {labelOf(rec.kinds, municipality)}
      </span>
      <strong className="rec-total">{formatCop(rec.productsCop)}</strong>
      <span id={`${id}-body`} className="rec-body">
        <span className="rec-stores">
          {[...rec.option.shares]
            .map(({ store }) => store)
            .sort((x, y) => (x.distanceM ?? 0) - (y.distanceM ?? 0) || x.name.localeCompare(y.name))
            .map((store) => (
              <span key={store.id}>
                {store.name}
                {store.distanceM !== undefined &&
                  (store.distanceM < NEAR_M
                    ? ' · a pasos de ti'
                    : ` · a ${formatDistance(store.distanceM)} (${walk(walkMin(store.distanceM))})`)}
              </span>
            ))}
        </span>
        {rec.covered < rec.total && (
          <span className="muted">{`Cubre ${String(rec.covered)} de ${String(rec.total)} productos`}</span>
        )}
        {rec.option.stores > 1 && <span className="muted">{spread(rec)}</span>}
        {gain && <span>{gain}</span>}
        {rec.notes.includes('maybeNotCheapest') && (
          <span className="muted">Puede no ser la más barata.</span>
        )}
      </span>
    </label>
  );
}
