import type { ReactNode } from 'react';
import './chipRow.css';

// Grupo de chips (categorías) que pasan a varias líneas cuando no caben: todos se ven a la vez, sin
// renglón que se desliza de lado, sin flechas y sin bordes difuminados que escondan opciones (el scroll
// horizontal escondido no se descubre y a veces ni se alcanza). Con el teclado se usan las flechas del
// grupo de opciones, y el navegador mantiene a la vista la elegida.
export function ChipRow({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset role="radiogroup" className="category-chips chip-row">
      <legend className="sr-only">{legend}</legend>
      {children}
    </fieldset>
  );
}
