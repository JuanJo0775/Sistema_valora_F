import { useState } from 'react';
import { SelectField } from '../../shared/ui/SelectField';
import type { TravelAssumptions } from './travel';

const MODES: { value: TravelAssumptions['mode']; label: string }[] = [
  { value: 'none', label: 'A pie (sin costo en pesos)' },
  { value: 'fare', label: 'Pasaje' },
  { value: 'perKm', label: 'Costo por km' },
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

// Los supuestos del traslado, siempre a la vista y editables. Sin valor en pesos por defecto.
export function AssumptionsForm({
  value,
  onChange,
  level = 2,
}: {
  value: TravelAssumptions;
  onChange: (next: TravelAssumptions) => void;
  // Nivel del título: 3 cuando va dentro de un panel que ya tiene su h2.
  level?: 2 | 3;
}) {
  const Title = `h${String(level)}` as 'h2' | 'h3';
  // Se escribe como texto para poder borrar y teclear; solo lo válido sube a los supuestos.
  const [detour, setDetour] = useState(String(value.detour));
  const [kmh, setKmh] = useState(String(value.kmh));
  const [fare, setFare] = useState(value.fareCop === undefined ? '' : String(value.fareCop));
  const [perKm, setPerKm] = useState(value.perKmCop === undefined ? '' : String(value.perKmCop));

  const money = (text: string) => {
    const number = toNumber(text);
    return number !== null && number >= 0 ? number : undefined;
  };

  return (
    <section className="plan-assumptions" aria-labelledby="plan-assumptions-title">
      <Title id="plan-assumptions-title">Supuestos del traslado</Title>
      <p className="muted">
        Todo traslado es estimado. Cambia estos supuestos y los cálculos se actualizan.
      </p>
      <div className="plan-fields">
        <label className="field">
          Factor de rodeo
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="0.1"
            value={detour}
            onChange={(event) => {
              setDetour(event.target.value);
              const next = toNumber(event.target.value);
              if (next !== null && next >= 1) onChange({ ...value, detour: next });
            }}
          />
        </label>
        <label className="field">
          Velocidad a pie (km/h)
          <input
            type="number"
            inputMode="decimal"
            min="0.5"
            step="0.5"
            value={kmh}
            onChange={(event) => {
              setKmh(event.target.value);
              const next = toNumber(event.target.value);
              if (next !== null && next > 0) onChange({ ...value, kmh: next });
            }}
          />
        </label>
        <SelectField
          label="Cómo cuentas el traslado"
          value={value.mode}
          options={MODES}
          onChange={(mode) => {
            onChange({ ...value, mode });
          }}
        />
        {value.mode === 'fare' && (
          <label className="field">
            Pasaje por tramo (COP)
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
            Costo por km (COP)
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
      </div>
      <p className="muted">
        {value.mode === 'none'
          ? 'Sin pasaje ni costo por km, mostramos solo kilómetros y minutos.'
          : 'El valor en pesos es el que escribiste; no lo inventamos.'}
      </p>
    </section>
  );
}
