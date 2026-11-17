import { useId, useState } from 'react';
import { MUNICIPALITIES } from './criteria';
import { type Where, WhereChooser } from './WhereChooser';
import './comparison.css';

const KM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

// Prototipo de referencia: dónde se busca se lee en un chip («Armenia» o «Cerca de ti · 2 km»).
// Al tocarlo se elige el municipio, se usa la ubicación o se cambia el radio (WhereChooser).
export function WhereChip({
  where,
  backLabel,
  onLeaveLocation,
}: {
  where: Where;
  backLabel: string;
  onLeaveLocation?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const place = where.point
    ? `Cerca de ti · ${KM.format(where.radiusKm)} km`
    : MUNICIPALITIES[where.municipality];
  return (
    <div className="where">
      <button
        type="button"
        className="where-chip"
        aria-label={`Dónde buscar: ${place}`}
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="where-icon">
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        {place}
      </button>
      {open && (
        <div id={panel} className="where-panel">
          <WhereChooser where={where} backLabel={backLabel} onLeaveLocation={onLeaveLocation} />
        </div>
      )}
    </div>
  );
}
