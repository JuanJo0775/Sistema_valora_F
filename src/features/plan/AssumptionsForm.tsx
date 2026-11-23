import { useId, useState } from 'react';
import type { TravelAssumptions } from './travel';

const MODES: { value: TravelAssumptions['mode']; label: string }[] = [
  { value: 'none', label: 'Voy a pie' },
  { value: 'fare', label: 'Pago pasaje' },
  { value: 'perKm', label: 'Gasto por km' },
];

// Lo que escribe la persona: vacío o inválido no cambia el supuesto.
const toNumber = (text: string): number | null => {
  if (text.trim() === '') return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
};

// El mismo supuesto con un valor en pesos nuevo, o sin él si se borró.
function withMoney(
  value: TravelAssumptions,
  key: 'fareCop' | 'perKmCop',
  amount: number | undefined,
): TravelAssumptions {
  const { fareCop, perKmCop, ...base } = value;
  const next: TravelAssumptions = { ...base };
  const fare = key === 'fareCop' ? amount : fareCop;
  const perKm = key === 'perKmCop' ? amount : perKmCop;
  if (fare !== undefined) next.fareCop = fare;
  if (perKm !== undefined) next.perKmCop = perKm;
  return next;
}

// «¿Cuánto te cuesta ir?»: plegado y opcional. El factor de rodeo (1,3) y la velocidad a pie (4,5 km/h)
// son fijos (DEFAULT_ASSUMPTIONS) y ya no se piden. Sin pesos por defecto: sin ese dato solo se
// muestran kilómetros y minutos.
export function AssumptionsForm({
  value,
  onChange,
}: {
  value: TravelAssumptions;
  onChange: (next: TravelAssumptions) => void;
}) {
  const name = useId();
  // Se escribe como texto para poder borrar y teclear; solo lo válido sube a los supuestos.
  const [fare, setFare] = useState(value.fareCop === undefined ? '' : String(value.fareCop));
  const [perKm, setPerKm] = useState(value.perKmCop === undefined ? '' : String(value.perKmCop));

  const money = (text: string) => {
    const number = toNumber(text);
    return number !== null && number >= 0 ? number : undefined;
  };

  return (
    <details className="plan-fold plan-assumptions">
      <summary>¿Cuánto te cuesta ir?</summary>
      <fieldset role="radiogroup" className="category-chips" aria-label="Cómo te desplazas">
        {MODES.map(({ value: mode, label }) => (
          <label key={mode} className="category-chip">
            <input
              type="radio"
              name={`traslado-${name}`}
              value={mode}
              checked={value.mode === mode}
              onChange={() => {
                onChange({ ...value, mode });
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {value.mode === 'fare' && (
        <label className="field">
          Pasaje por viaje (COP)
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="100"
            value={fare}
            onChange={(event) => {
              setFare(event.target.value);
              onChange(withMoney(value, 'fareCop', money(event.target.value)));
            }}
          />
        </label>
      )}
      {value.mode === 'perKm' && (
        <label className="field">
          Gasto por km (COP)
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="100"
            value={perKm}
            onChange={(event) => {
              setPerKm(event.target.value);
              onChange(withMoney(value, 'perKmCop', money(event.target.value)));
            }}
          />
        </label>
      )}
      <p className="muted">
        {value.mode === 'none'
          ? 'Sin pasaje ni gasto por km, mostramos solo kilómetros y minutos.'
          : 'El valor en pesos es el que escribiste; no lo inventamos.'}
      </p>
    </details>
  );
}
