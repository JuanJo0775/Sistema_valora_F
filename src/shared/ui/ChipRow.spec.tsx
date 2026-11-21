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

  it('observa su tamaño, marca los bordes con más contenido y deja de observar al desmontarse', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(public callback: () => void) {}
        observe = observe;
        disconnect = disconnect;
      },
    );
    const { unmount } = render(
      <ChipRow legend="Categoría">
        <span>x</span>
      </ChipRow>,
    );
    const group = screen.getByRole('radiogroup');
    const box = document.querySelector('.chip-row') as HTMLElement;
    expect(observe).toHaveBeenCalledWith(group);
    expect(box).not.toHaveAttribute('data-start');

    // Con contenido de sobra y desplazado a mitad de camino hay más a los dos lados.
    Object.defineProperty(group, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(group, 'clientWidth', { value: 300, configurable: true });
    group.scrollLeft = 200;
    fireEvent.scroll(group);
    expect(box).toHaveAttribute('data-start', 'more');
    expect(box).toHaveAttribute('data-end', 'more');

    unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('al elegir un chip lo deja entero a la vista, fuera del borde difuminado', () => {
    render(
      <ChipRow legend="Categoría">
        {['Bebidas', 'Lácteos', 'Panadería'].map((name) => (
          <label key={name}>
            <input type="radio" name="c" />
            {name}
          </label>
        ))}
      </ChipRow>,
    );
    const group = screen.getByRole('radiogroup');
    const scrollBy = vi.fn();
    group.scrollBy = scrollBy;
    const rect = (left: number, right: number) => () =>
      ({ left, right, top: 0, bottom: 0, width: right - left, height: 0 }) as DOMRect;
    group.getBoundingClientRect = rect(100, 400);
    const left = screen.getByText('Bebidas');
    const right = screen.getByText('Lácteos');
    const center = screen.getByText('Panadería');
    left.getBoundingClientRect = rect(110, 190);
    right.getBoundingClientRect = rect(330, 395);
    center.getBoundingClientRect = rect(200, 280);
    const pick = (label: HTMLElement) => {
      fireEvent.click(label.querySelector('input') as HTMLElement);
    };

    // Chip pegado al borde izquierdo: se desplaza hacia atrás lo que invade la franja difuminada.
    pick(left);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 110 - 100 - 36 });

    // Chip pegado al borde derecho: se desplaza hacia adelante.
    pick(right);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 395 - 400 + 36 });

    // Chip ya cómodo en el centro: no se mueve.
    scrollBy.mockClear();
    pick(center);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
