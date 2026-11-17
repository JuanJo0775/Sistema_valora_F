import { useId } from 'react';

const KM = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// #73 (prototipo, ADR-019): el radio de búsqueda con una barra deslizable, de 0,5 a 3 km.
export function RadiusSlider({
  radiusKm,
  onChange,
}: {
  radiusKm: number;
  onChange: (radiusKm: number) => void;
}) {
  const id = useId();
  return (
    <div className="radius-slider">
      <label htmlFor={id}>Radio</label>
      <input
        id={id}
        type="range"
        min={0.5}
        max={3}
        step={0.5}
        value={radiusKm}
        aria-valuetext={`${KM.format(radiusKm)} km`}
        style={{ '--fill': `${String(((radiusKm - 0.5) / 2.5) * 100)}%` } as React.CSSProperties}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
      <output htmlFor={id}>{`${KM.format(radiusKm)} km`}</output>
    </div>
  );
}
