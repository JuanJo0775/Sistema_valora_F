import { useId } from 'react';

// Un ajuste que se enciende y se apaga (prototipo: el interruptor de la derecha en «Ajustes»).
export function SettingSwitch({
  title,
  description,
  on,
  onChange,
}: {
  title: string;
  description: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <li>
      <span className="settings-text">
        <strong id={`${id}-title`}>{title}</strong>
        <span className="muted" id={`${id}-text`}>
          {description}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        className="switch"
        onClick={() => {
          onChange(!on);
        }}
      />
    </li>
  );
}
