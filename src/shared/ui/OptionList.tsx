import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

// Desde cuántas opciones conviene poder escribir para filtrar.
export const SEARCH_FROM = 8;

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface Option<T extends string> {
  value: T;
  label: string;
}

// Una lista propia (rol listbox) para elegir una opción: la elegida lleva su check, las flechas
// recorren, Inicio y Fin saltan, Enter o Espacio eligen y escribir una letra va a la opción que
// empieza así. Con 8 o más opciones trae un campo para filtrar.
export function OptionList<T extends string>({
  label,
  options,
  value,
  onSelect,
  autoFocus = false,
}: {
  label: string;
  options: Option<T>[];
  value: T | null;
  onSelect: (value: T) => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const shown = options.filter((option) => plain(option.label).includes(plain(query.trim())));
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const typed = useRef({ text: '', at: 0 });
  const index = Math.min(active, Math.max(shown.length - 1, 0));
  const activeId = shown[index] ? `${id}-${String(index)}` : undefined;

  useEffect(() => {
    document.getElementById(`${id}-${String(index)}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, index]);

  const move = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') setActive(Math.min(index + 1, shown.length - 1));
    else if (event.key === 'ArrowUp') setActive(Math.max(index - 1, 0));
    else if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(shown.length - 1);
    else return false;
    event.preventDefault();
    return true;
  };
  const choose = (event: KeyboardEvent) => {
    const option = shown[index];
    if (!option) return;
    event.preventDefault();
    onSelect(option.value);
  };

  const onListKey = (event: KeyboardEvent) => {
    if (move(event)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      choose(event);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - typed.current.at > 700 ? '' : typed.current.text) + event.key;
      typed.current = { text, at: now };
      const found = shown.findIndex((option) => plain(option.label).startsWith(plain(text)));
      if (found >= 0) setActive(found);
    }
  };
  const onSearchKey = (event: KeyboardEvent) => {
    if (move(event)) return;
    if (event.key === 'Enter') choose(event);
  };

  return (
    <div className="option-list">
      {options.length >= SEARCH_FROM && (
        <input
          type="search"
          className="option-search"
          aria-label={`Buscar ${label.toLowerCase()}`}
          placeholder="Escribe para buscar"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onSearchKey}
        />
      )}
      {/* El teclado lo maneja la lista (aria-activedescendant); el toque, cada opción. */}
      <ul
        className="option-items"
        role="listbox"
        aria-label={label}
        tabIndex={0}
        data-autofocus={autoFocus ? '' : undefined}
        aria-activedescendant={activeId}
        onKeyDown={onListKey}
      >
        {shown.map((option, position) => (
          <li
            key={option.value}
            id={`${id}-${String(position)}`}
            role="option"
            aria-selected={option.value === value}
            className={position === index ? 'option active' : 'option'}
            onMouseMove={() => {
              if (position !== index) setActive(position);
            }}
            onClick={() => {
              onSelect(option.value);
            }}
          >
            <span className="option-label">{option.label}</span>
            {option.value === value && (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="option-check">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <p className="option-empty" role="status">
          {`Sin resultados para «${query.trim()}».`}
        </p>
      )}
    </div>
  );
}
