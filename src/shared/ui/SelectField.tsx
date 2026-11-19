import { useId, useRef, useState } from 'react';
import { type Option, OptionList } from './OptionList';
import { Overlay } from './Overlay';

// Una lista desplegable con su etiqueta visible (WCAG 2.2: cada campo dice qué pide). El
// desplegable es propio (popover o, en celular, hoja inferior), igual en todos los navegadores y
// con los colores de la app; no usa el <select> del sistema.
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const valueId = useId();
  const current = options.find((option) => option.value === value);
  return (
    <div className="field">
      <span id={labelId}>{label}</span>
      <button
        ref={trigger}
        type="button"
        className="select-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => {
          setOpen((now) => !now);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span id={valueId} className="select-value">
          {current?.label ?? ''}
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="select-chevron">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <Overlay
          anchor={trigger}
          title={label}
          onClose={() => {
            setOpen(false);
          }}
        >
          <OptionList
            label={label}
            options={options}
            value={value}
            autoFocus
            onSelect={(chosen) => {
              onChange(chosen);
              setOpen(false);
            }}
          />
        </Overlay>
      )}
    </div>
  );
}
