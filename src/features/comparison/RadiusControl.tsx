import { useEffect, useId, useRef, useState } from 'react';
import {
  MAX_RADIUS_KM,
  MIN_RADIUS_KM,
  normalizeRadius,
  RADII,
  RADIUS_STEP_KM,
  radiusLabel,
  radiusSpoken,
} from './radius';
import './radiusControl.css';

// Cuánto se espera sin movimiento antes de dar por elegido un radio arrastrado.
const SETTLE_MS = 300;
// Posición de un valor en la barra, de 0 (mínimo) a 1 (máximo).
const fraction = (km: number) => (km - MIN_RADIUS_KM) / (MAX_RADIUS_KM - MIN_RADIUS_KM);

// El radio de búsqueda: valor grande, barra deslizable y chips de preajustes, siempre sincronizados.
// Mientras se arrastra, el valor (y `onPreview`, p. ej. el círculo del mapa) cambia al instante;
// `onChange` —la consulta y el guardado— solo llega al soltar o tras 300 ms sin movimiento.
// Un chip elige el valor de una vez.
export function RadiusControl({
  radiusKm,
  onChange,
  onPreview,
  title,
  help,
  note,
}: {
  radiusKm: number;
  onChange: (radiusKm: number) => void;
  // El valor que se está arrastrando, o null cuando ya se eligió el definitivo.
  onPreview?: (radiusKm: number | null) => void;
  // Un título y una línea de ayuda propios (en el mapa: «Radio de búsqueda»); por defecto, «Radio».
  title?: string;
  help?: string;
  // Un aviso debajo (en el mapa, cuando todavía no hay ubicación).
  note?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shown = draft ?? radiusKm;

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  const commit = (km: number) => {
    clearTimeout(timer.current);
    pending.current = null;
    setDraft(null);
    onPreview?.(null);
    onChange(km);
  };
  const flush = () => {
    if (pending.current !== null) commit(pending.current);
  };
  const drag = (km: number) => {
    pending.current = km;
    setDraft(km);
    onPreview?.(km);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SETTLE_MS);
  };

  return (
    <div className="radius-control">
      <div className="radius-head">
        <label htmlFor={id} className="radius-label">
          {title ?? 'Radio'}
        </label>
        <span className="radius-value" aria-hidden="true">
          {radiusLabel(shown)}
        </span>
      </div>
      {help && <p className="radius-help">{help}</p>}
      <div className="radius-track">
        <div className="radius-ticks" aria-hidden="true">
          {RADII.map((km) => (
            <span
              key={km}
              className="radius-tick"
              style={{ '--p': fraction(km) } as React.CSSProperties}
            />
          ))}
        </div>
        <input
          id={id}
          type="range"
          className="radius-slider"
          min={MIN_RADIUS_KM}
          max={MAX_RADIUS_KM}
          step={RADIUS_STEP_KM}
          value={shown}
          aria-valuetext={radiusSpoken(shown)}
          style={{ '--p': fraction(shown) } as React.CSSProperties}
          onChange={({ target }) => {
            drag(normalizeRadius(Number(target.value)));
          }}
          onPointerUp={flush}
          onBlur={flush}
        />
      </div>
      <fieldset
        role="radiogroup"
        className="category-chips"
        aria-label={title ? `${title}: valores rápidos` : 'Radio de búsqueda'}
      >
        {RADII.map((km) => (
          <label key={km} className="category-chip">
            <input
              type="radio"
              name={`radio-${id}`}
              value={km}
              checked={shown === km}
              onChange={() => {
                commit(km);
              }}
            />
            {radiusLabel(km)}
          </label>
        ))}
      </fieldset>
      {note && <p className="radius-note">{note}</p>}
    </div>
  );
}
