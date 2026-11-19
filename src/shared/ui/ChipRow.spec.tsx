import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChipRow } from './ChipRow';

describe('renglón de chips', () => {
  it('es un grupo de opciones con nombre y las flechas del ratón no estorban al teclado ni a los lectores', () => {
    render(
      <ChipRow legend="Categoría">
        <label>
          <input type="radio" name="c" />
          Todo
        </label>
      </ChipRow>,
    );

    expect(screen.getByRole('radiogroup', { name: 'Categoría' })).toBeInTheDocument();
    for (const arrow of document.querySelectorAll('.chip-arrow')) {
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
      expect(arrow).toHaveAttribute('tabindex', '-1');
    }
  });

  it('las flechas desplazan el renglón', () => {
    render(
      <ChipRow legend="Categoría">
        <span>x</span>
      </ChipRow>,
    );
    const group = screen.getByRole('radiogroup');
    const scrollBy = vi.fn();
    group.scrollBy = scrollBy;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );

    fireEvent.click(document.querySelector('.chip-arrow.end') as HTMLElement);
    fireEvent.click(document.querySelector('.chip-arrow.start') as HTMLElement);

    expect(scrollBy).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
