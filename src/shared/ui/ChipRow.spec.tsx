import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChipRow } from './ChipRow';

describe('grupo de chips', () => {
  it('es un grupo de opciones con nombre y sus chips', () => {
    render(
      <ChipRow legend="Categoría">
        <label>
          <input type="radio" name="c" />
          Todo
        </label>
        <label>
          <input type="radio" name="c" />
          Bebidas
        </label>
      </ChipRow>,
    );

    const group = screen.getByRole('radiogroup', { name: 'Categoría' });
    expect(group).toContainElement(screen.getByRole('radio', { name: 'Todo' }));
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('no tiene flechas ni botones escondidos: no hay nada que desplazar', () => {
    render(
      <ChipRow legend="Categoría">
        <span>x</span>
      </ChipRow>,
    );

    expect(screen.queryByRole('button', { hidden: true })).not.toBeInTheDocument();
    expect(document.querySelector('.chip-arrow')).toBeNull();
  });
});
