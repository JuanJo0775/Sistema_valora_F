import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import './chipRow.css';

// Renglón de chips (categorías) en una sola fila que se desliza: con el dedo, con la rueda o el
// trackpad y, con ratón, con dos flechas. El borde se difumina hacia donde aún hay más. Con el
// teclado se usan las flechas del grupo de opciones, y el navegador mantiene a la vista la elegida.
// Ancho del borde difuminado (chipRow.css): lo elegido no debe quedar debajo de él.
const FADE = 36;

export function ChipRow({ legend, children }: { legend: string; children: ReactNode }) {
  const row = useRef<HTMLFieldSetElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const element = row.current;
    if (!element) return;
    const start = element.scrollLeft > 4;
    const end = element.scrollLeft + element.clientWidth < element.scrollWidth - 4;
    setEdges((current) =>
      current.start === start && current.end === end ? current : { start, end },
    );
  }, []);

  useEffect(() => {
    measure();
    const element = row.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [measure, children]);

  const move = (direction: 1 | -1) => {
    const element = row.current;
    if (!element) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior });
  };

  return (
    <div
      className="chip-row"
      data-start={edges.start ? 'more' : undefined}
      data-end={edges.end ? 'more' : undefined}
    >
      {/* Ayuda para el ratón: el teclado y los lectores usan el grupo de opciones. */}
      <button
        type="button"
        className="chip-arrow start"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          move(-1);
        }}
      >
        ‹
      </button>
      <fieldset
        role="radiogroup"
        className="category-chips"
        ref={row}
        onScroll={measure}
        onChange={(event) => {
          // La opción elegida (con el dedo, el ratón o las flechas del teclado) queda entera a la vista,
          // fuera de la franja difuminada de los bordes.
          const chip = (event.target as HTMLElement).closest('label');
          const element = row.current;
          if (!chip || !element || typeof element.scrollBy !== 'function') return;
          const chipBox = chip.getBoundingClientRect();
          const rowBox = element.getBoundingClientRect();
          const left = chipBox.left - rowBox.left - FADE;
          const right = chipBox.right - rowBox.right + FADE;
          if (left < 0) element.scrollBy({ left });
          else if (right > 0) element.scrollBy({ left: right });
        }}
      >
        <legend className="sr-only">{legend}</legend>
        {children}
      </fieldset>
      <button
        type="button"
        className="chip-arrow end"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          move(1);
        }}
      >
        ›
      </button>
    </div>
  );
}
