import { useState } from 'react';
import { type Theme, THEMES, getTheme, setTheme } from '../../shared/theme';

// Elegir el tema de la app: como el sistema, claro u oscuro. Se recuerda en este dispositivo.
export function ThemeChoice() {
  const [theme, setCurrent] = useState<Theme>(getTheme);
  return (
    <fieldset className="theme-choice">
      <legend>
        <strong>Tema</strong>
      </legend>
      <div className="theme-options" role="radiogroup" aria-label="Tema">
        {THEMES.map((option) => (
          <label key={option.value} className="theme-option">
            <input
              type="radio"
              name="tema"
              value={option.value}
              checked={theme === option.value}
              onChange={() => {
                setTheme(option.value);
                setCurrent(option.value);
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
