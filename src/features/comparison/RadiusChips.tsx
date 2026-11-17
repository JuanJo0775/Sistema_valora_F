import { RADII, radiusLabel } from './radius';

// El radio como chips fáciles de tocar en el celular (mismos que los de categoría).
export function RadiusChips({
  radiusKm,
  onChange,
}: {
  radiusKm: number;
  onChange: (radiusKm: number) => void;
}) {
  return (
    <fieldset role="radiogroup" className="category-chips" aria-label="Radio de búsqueda">
      {RADII.map((km) => (
        <label key={km} className="category-chip">
          <input
            type="radio"
            name="radio"
            value={km}
            checked={radiusKm === km}
            onChange={() => {
              onChange(km);
            }}
          />
          {radiusLabel(km)}
        </label>
      ))}
    </fieldset>
  );
}
