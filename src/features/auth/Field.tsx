import { type InputHTMLAttributes, useEffect, useRef, useState } from 'react';
import { Icon } from '../../app/Icon';
import './field.css';

// Un campo con su etiqueta visible (WCAG 2.2: cada campo dice qué pide). Si es de contraseña,
// lleva un botón de ojo para mostrar u ocultar lo escrito. El estado vive solo en este componente:
// la contraseña no se guarda ni se registra en ningún sitio.
export function Field({
  label,
  onValue,
  ...input
}: { label: string; onValue: (value: string) => void } & InputHTMLAttributes<HTMLInputElement>) {
  const isPassword = input.type === 'password';
  const [shown, setShown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Al enviar el formulario la contraseña vuelve a ocultarse. Al salir de la pantalla el
  // componente se desmonta y el estado desaparece con él.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!isPassword || !form) return;
    const hide = () => {
      setShown(false);
    };
    form.addEventListener('submit', hide);
    return () => {
      form.removeEventListener('submit', hide);
    };
  }, [isPassword]);

  return (
    <label className="field">
      {label}
      <span className="field-control">
        <input
          required
          {...input}
          ref={inputRef}
          type={isPassword && shown ? 'text' : input.type}
          onChange={(event) => {
            onValue(event.target.value);
          }}
        />
        {isPassword && (
          <button
            type="button"
            className="field-eye"
            aria-pressed={shown}
            aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => {
              setShown((now) => !now);
            }}
          >
            <Icon name={shown ? 'eyeOff' : 'eye'} />
          </button>
        )}
      </span>
    </label>
  );
}
