import { useId, useRef, type KeyboardEvent } from 'react';
import { formatDistance } from '../../shared/location';
import { formatCop } from '../../shared/money';
import { radiusLabel } from '../comparison/radius';
import { AT_STORE_M } from '../plan/nearby';
import type { Kind, Notice, Recommendation } from '../plan/recommend';

const KM = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const km = (value: number) => `${KM.format(value)} km`;
const walk = (minutes: number) => `≈ ${String(minutes)} min a pie`;

const LABELS: Record<Kind, (municipality: string) => string> = {
  cheapest: () => 'La más barata',
  single: () => 'Todo en una tienda',
  nearest: () => 'La más cercana',
  cheapestAll: (municipality) => `La más barata en ${municipality}`,
  mostCovered: () => 'La que más cubre',
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
  return meters < AT_STORE_M ? 'está a pasos de ti' : `está a ${formatDistance(meters)}`;
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

// Una sola explicación de por qué no hay «todo en una tienda» y qué sí cubre la lista.
function noSingleText({ covered, total, full, stores }: Extract<Notice, { type: 'noSingle' }>) {
  if (full === 'area') {
    return `Ninguna tienda sola tiene toda tu lista; con ${String(stores)} tiendas sí la cubres.`;
  }
  if (full === 'municipality') {
    return stores === 1
      ? 'Cerca de ti, ninguna tienda tiene toda tu lista; una del municipio sí la tiene.'
      : `Cerca de ti, ninguna tienda sola tiene toda tu lista; con ${String(stores)} tiendas del municipio sí la cubres.`;
  }
  return `Ninguna combinación de hasta 3 tiendas cubre toda tu lista; la que más cubre tiene ${String(covered)} de ${String(total)}.`;
}

export function noticeText(notice: Notice): string {
  switch (notice.type) {
    case 'shareLocation':
      return 'Comparte tu ubicación para ver la más cercana.';
    case 'noneInRadius':
      return `No hay tiendas con tu lista a ${radiusLabel(notice.radiusKm)}; te mostramos las del municipio.`;
    case 'noSingle':
      return noSingleText(notice);
  }
}

// Las recomendaciones como opciones de un grupo (radiogroup con aspecto segmentado): se ve una a la
// vez en detalle. Si no caben en una fila, se envuelven; nunca se desplazan de lado. Flechas para
// moverse (como las fichas del radio de búsqueda).
export function RecommendationCards({
  items,
  selectedId,
  onSelect,
  municipality,
}: {
  items: Recommendation[];
  selectedId: string;
  onSelect: (id: string) => void;
  municipality: string;
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
      className="rec-seg"
      aria-label="Recomendaciones"
      onKeyDown={move}
    >
      {items.map((rec) => (
        <Option
          key={rec.id}
          rec={rec}
          group={name}
          checked={rec.id === selectedId}
          onSelect={onSelect}
          municipality={municipality}
        />
      ))}
    </fieldset>
  );
}

function Option({
  rec,
  group,
  checked,
  onSelect,
  municipality,
}: {
  rec: Recommendation;
  group: string;
  checked: boolean;
  onSelect: (id: string) => void;
  municipality: string;
}) {
  const id = useId();
  return (
    <label className="rec-option">
      <input
        type="radio"
        name={`recomendacion-${group}`}
        checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-total`}
        onChange={() => {
          onSelect(rec.id);
        }}
      />
      <span id={`${id}-label`} className="rec-label">
        {labelOf(rec.kinds, municipality)}
      </span>
      <strong id={`${id}-total`} className="rec-total">
        {formatCop(rec.productsCop)}
      </strong>
    </label>
  );
}

// Lo que dice la recomendación elegida: cuánto se gana o se paga de más, cuánto cubre y si hay que
// desplazarse entre tiendas. Las tiendas, con sus productos, van debajo (OptionCard).
export function RecommendationDetail({ rec, located }: { rec: Recommendation; located: boolean }) {
  const gain = gainSentence(rec, located);
  return (
    <div className="rec-detail">
      {gain && <p className="rec-gain">{gain}</p>}
      {rec.covered < rec.total && (
        <p className="muted">{`Cubre ${String(rec.covered)} de ${String(rec.total)} productos`}</p>
      )}
      {rec.option.stores > 1 && <p className="muted">{spread(rec)}</p>}
      {rec.notes.includes('maybeNotCheapest') && (
        <p className="muted">Puede no ser la más barata.</p>
      )}
    </div>
  );
}
