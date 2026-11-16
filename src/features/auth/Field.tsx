import type { InputHTMLAttributes } from 'react';

// Un campo con su etiqueta visible (WCAG 2.2: cada campo dice qué pide).
export function Field({
  label,
  onValue,
  ...input
}: { label: string; onValue: (value: string) => void } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      {label}
      <input
        required
        {...input}
        onChange={(event) => {
          onValue(event.target.value);
        }}
      />
    </label>
  );
}
